import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { grantAdUnlock } from "@/lib/quota";
import { apiError, getRequestContext, json, preflight } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Rewarded-ad unlock (plan §6).
 *
 * MVP stub: the server issues a signed, single-use nonce (GET), the client
 * "watches" an ad, and redeems the nonce (POST). The real version moves the
 * grant to an AdMob server-side-verification callback that Google signs; see
 * 광고.md §2. The nonce ledger and the daily cap carry over to it.
 *
 * Two things stop this being free money: the HMAC (a client can't mint a
 * nonce) and the unique constraint on `ad_views.nonce` (a nonce can't be
 * replayed). The per-day cap in `grantAdUnlock` bounds the damage if both fail.
 */

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;

/** A nonce is only good for this long — an ad view shouldn't be bankable. */
const NONCE_TTL_MS = 10 * 60 * 1000;

function secret(): string {
  const value = process.env.AD_REWARD_SECRET;
  if (!value) throw new Error("Missing environment variable: AD_REWARD_SECRET");
  return value;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("hex");
}

function verify(nonce: string): { userId: string; issuedAt: number } | null {
  const [userId, issuedAt, signature] = nonce.split(".");
  if (!userId || !issuedAt || !signature) return null;

  const expected = sign(`${userId}.${issuedAt}`);
  const a = Buffer.from(signature, "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  // `issuedAt` is `<millis>-<random>` (see GET), so it has to be split before it
  // parses as a number. `Number()` on the whole thing is NaN.
  const at = Number(issuedAt.split("-")[0]);
  if (!Number.isFinite(at) || Date.now() - at > NONCE_TTL_MS) return null;

  return { userId, issuedAt: at };
}

/** Issue a nonce for an ad view that is about to start. */
export async function GET(request: Request) {
  const { user } = await getRequestContext(request);

  if (!user) {
    return apiError(request, "unauthenticated", 401);
  }

  // The random segment keeps two views in the same millisecond distinct.
  const issuedAt = `${Date.now()}-${randomUUID().slice(0, 8)}`;
  const payload = `${user.id}.${issuedAt}`;

  return json(request, { nonce: `${payload}.${sign(payload)}` });
}

/** Redeem a nonce after the ad completed. */
export async function POST(request: Request) {
  const { user } = await getRequestContext(request);

  if (!user) {
    return apiError(request, "unauthenticated", 401);
  }

  let nonce: string | undefined;
  try {
    nonce = (await request.json())?.nonce;
  } catch {
    // handled below
  }

  const claim = nonce ? verify(nonce) : null;
  if (!claim || claim.userId !== user.id) {
    return apiError(request, "invalid nonce", 400);
  }

  const admin = createAdminClient();

  // The unique constraint — not a prior SELECT — is what makes this single-use.
  const { error: insertError } = await admin
    .from("ad_views")
    .insert({ user_id: user.id, nonce, reward_verified: false });

  if (insertError) {
    return apiError(request, "nonce already used", 409);
  }

  const quota = await grantAdUnlock(admin, user.id);
  if (!quota) {
    return apiError(request, "daily ad unlock limit reached", 429);
  }

  // `lib/quota.ts` counts the daily cap off this flag, so it has to be the last
  // write — a row flipped before the grant would count a view that never paid out.
  await admin.from("ad_views").update({ reward_verified: true }).eq("nonce", nonce);

  return json(request, { quota });
}

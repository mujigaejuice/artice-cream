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
  const parts = nonce.split(".");
  const [userId, issuedAt, signature] = parts;
  if (parts.length !== 3 || !userId || !/^\d+-[a-f0-9]{8}$/.test(issuedAt) ||
    !/^[a-f0-9]{64}$/.test(signature)) return null;

  const expected = sign(`${userId}.${issuedAt}`);
  const a = Buffer.from(signature, "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  // `issuedAt` is `<millis>-<random>` (see GET), so it has to be split before it
  // parses as a number. `Number()` on the whole thing is NaN.
  const at = Number(issuedAt.split("-")[0]);
  const age = Date.now() - at;
  if (!Number.isSafeInteger(at) || age < 0 || age > NONCE_TTL_MS) return null;

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

  let nonce: unknown;
  try {
    nonce = (await request.json())?.nonce;
  } catch {
    // handled below
  }

  if (typeof nonce !== "string" || nonce.length > 512) {
    return apiError(request, "invalid nonce", 400);
  }
  const claim = verify(nonce);
  if (!claim || claim.userId !== user.id) {
    return apiError(request, "invalid nonce", 400);
  }

  try {
    const result = await grantAdUnlock(createAdminClient(), user.id, nonce);
    if (result.status === "conflict") return apiError(request, "nonce already used", 409);
    if (result.status === "limit") return apiError(request, "daily ad unlock limit reached", 429);
    // A verified replay returns success and the current balance, without a new grant.
    return json(request, { quota: result.quota });
  } catch {
    return apiError(request, "reward temporarily unavailable", 503);
  }
}

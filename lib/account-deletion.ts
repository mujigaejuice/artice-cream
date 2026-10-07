import type { User } from "@supabase/supabase-js";

/** Authentication time, not token issue time: refreshing a token is not reauthentication. */
export const DELETE_REAUTH_SECONDS = 10 * 60;

/** Call only AFTER Auth.getUser(token) has verified this exact bearer token. */
export function hasRecentAuthentication(token: string, user: User, now = Date.now()): boolean {
  try {
    const claims = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8"));
    if (claims.sub !== user.id || claims.role !== "authenticated" || !Array.isArray(claims.amr)) return false;
    return claims.amr.some((entry: { method?: unknown; timestamp?: unknown }) => {
      if (!entry || !["otp", "oauth", "password", "totp", "sso/saml", "magiclink"].includes(String(entry.method))) return false;
      if (typeof entry.timestamp !== "number" || !Number.isFinite(entry.timestamp)) return false;
      const age = now / 1000 - entry.timestamp;
      return age >= -30 && age <= DELETE_REAUTH_SECONDS;
    });
  } catch {
    return false;
  }
}

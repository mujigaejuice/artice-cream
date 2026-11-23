import { apiError, getRequestContext, json, preflight } from "@/lib/api";
import { DOMAIN_FLAVORS } from "@/lib/color";
import { safeEquipped, safeScoopColors } from "@/lib/cosmetics";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;

export async function POST(request: Request) {
  const { user } = await getRequestContext(request);
  if (!user) return apiError(request, "unauthenticated", 401);
  let body: unknown;
  try { body = await request.json(); }
  catch { return apiError(request, "invalid_body", 400); }
  const colors = body && typeof body === "object" && !Array.isArray(body)
    ? (body as Record<string, unknown>).colors : null;
  if (!colors || typeof colors !== "object" || Array.isArray(colors) ||
      Object.keys(colors).length > 8 ||
      Object.entries(colors).some(([domain, color]) =>
        !Object.hasOwn(DOMAIN_FLAVORS, domain) ||
        typeof color !== "string" || !/^#[0-9a-fA-F]{6}$/.test(color))) {
    return apiError(request, "invalid_body", 400);
  }
  try {
    const { data, error } = await createAdminClient().rpc("set_scoop_colors", {
      p_user_id: user.id, p_colors: colors,
    });
    if (error || !data || typeof data !== "object") throw error ?? new Error("Invalid colors result");
    if (typeof data.error === "string") {
      const status: Record<string, number> = { invalid_body: 400, unauthenticated: 401,
        item_not_owned: 403 };
      return apiError(request, data.error, status[data.error] ?? 503);
    }
    if (data.status !== "saved" || !data.equipped || typeof data.equipped !== "object") {
      throw new Error("Invalid colors result");
    }
    return json(request, { userId: user.id, equipped: safeEquipped(data.equipped),
      scoopColors: safeScoopColors(data.scoopColors) });
  } catch {
    return apiError(request, "shop_unavailable", 503);
  }
}

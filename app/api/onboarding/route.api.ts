import { apiError, getRequestContext, json, preflight } from "@/lib/api";
import { getDomains, getLevels } from "@/lib/feed";
import { getDomainTerms, type DomainTerms } from "@/lib/terms";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * 온보딩 데이터 (앱출시.md §2 — `app/onboarding/page.tsx`의 서버 쿼리가 여기로 왔다).
 *
 * 세션이 없어도 200이다. `domains`와 `domain_terms`는 RLS가 전체 읽기를 허용하고
 * (supabase/policies.sql), 로그인 화면이 온보딩에 있다.
 */

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;

export async function GET(request: Request) {
  const { user, supabase } = await getRequestContext(request);

  const domains = await getDomains(supabase);
  const [levels, termsByDomain] = await Promise.all([
    user ? getLevels(supabase, user.id) : new Map<number, number>(),
    getDomainTerms(supabase, domains.map((d) => d.id)),
  ]);

  const domainTerms: Record<string, DomainTerms> = {};
  for (const [domainId, terms] of termsByDomain) domainTerms[String(domainId)] = terms;

  return json(request, {
    domains,
    levels: Object.fromEntries(levels),
    domainTerms,
    isSignedIn: user != null,
  });
}

/** Existing proficiency is retained; only newly selected domains receive a starting level. */
export async function POST(request: Request) {
  const { user } = await getRequestContext(request);
  if (!user) return apiError(request, "unauthenticated", 401);

  let body: unknown;
  try { body = await request.json(); }
  catch { return apiError(request, "invalid body", 400); }
  const selections = body && typeof body === "object" && !Array.isArray(body)
    ? (body as Record<string, unknown>).selections : null;
  if (!Array.isArray(selections) || selections.length > 32 || selections.some((selection) =>
    !selection || typeof selection !== "object" || Array.isArray(selection) ||
    !Number.isSafeInteger(selection.domainId) || selection.domainId <= 0 ||
    !Number.isSafeInteger(selection.rareChecked) || selection.rareChecked < 0 ||
    selection.rareChecked > 4)) {
    return apiError(request, "invalid body", 400);
  }

  try {
    const { data, error } = await createAdminClient().rpc("save_onboarding_preferences", {
      p_user_id: user.id,
      p_selections: selections,
    });
    if (error || !data || typeof data !== "object") throw error ?? new Error("Invalid preferences result");
    if (typeof data.error === "string") {
      return apiError(request, data.error, data.error === "invalid body" ? 400 : 503);
    }
    if (data.ok !== true) throw new Error("Invalid preferences result");
    return json(request, data);
  } catch {
    return apiError(request, "preferences temporarily unavailable", 503);
  }
}

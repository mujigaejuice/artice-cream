import { getRequestContext, json, preflight } from "@/lib/api";
import { getDomains, getLevels } from "@/lib/feed";
import { getDomainTerms, type DomainTerms } from "@/lib/terms";

/**
 * 온보딩 데이터 (앱출시.md §2 — `app/onboarding/page.tsx`의 서버 쿼리가 여기로 왔다).
 *
 * 세션이 없어도 200이다. `domains`와 `domain_terms`는 RLS가 전체 읽기를 허용하고
 * (supabase/policies.sql), 익명 로그인은 클라이언트가 이 화면에서 한다.
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
    isGuest: user?.is_anonymous === true,
  });
}

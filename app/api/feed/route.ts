import { getRequestContext, json, preflight, serverTiming } from "@/lib/api";
import { getSourceRights } from "@/lib/content-rights";
import { getDomains, getLevels, getTodayPicks, getOriginalPicks, selectedDomains } from "@/lib/feed";
import { getQuota } from "@/lib/quota";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * 오늘 탭 데이터 (앱출시.md §2 — `app/(tabs)/page.tsx`의 서버 쿼리가 여기로 왔다).
 *
 * 쿼터는 여기서도 service role로 읽는다. 클라이언트에는 daily_quota 쓰기 권한이
 * 없고, 따라서 게이트로 신뢰할 만한 읽기 정책도 없기 때문. 게이트 자체는
 * `/api/read/open`이 쥐고 있다 — 이 응답의 canRead는 화면 표시용이다.
 *
 * 느린 건 DB 계산보다 차례로 기다리는 왕복이었다(2026-11-24 측정: 분야 하나 조회는
 * DB 안에서 3~13ms). 그래서 서로 기다릴 이유가 없는 조회는 묶어서 동시에 보낸다.
 * 구간별 시간은 `Server-Timing` 헤더로 본다(auth · base · picks · quota · originals).
 */

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;

export async function GET(request: Request) {
  const timing = serverTiming();
  const respond = (body: unknown) => timing.apply(json(request, body));
  const { user, supabase } = await timing.measure("auth", () => getRequestContext(request));

  // 세션이 없거나 수준 행이 없으면 온보딩을 끝내지 않은 것이다. 서버 컴포넌트가
  // redirect()로 하던 판정을, 이제는 클라이언트가 이 값을 보고 한다.
  if (!user) return respond({ status: "onboarding" });

  // 출처 권한은 오늘의 글과 기초 글이 같이 쓰므로 한 번만 읽는다.
  const [allDomains, levels, sources] = await timing.measure("base", () => Promise.all([
    getDomains(supabase),
    getLevels(supabase, user.id),
    getSourceRights(supabase),
  ]));
  if (levels.size === 0) return respond({ status: "onboarding" });

  // 소스분류.md §3 / 정책.md §9 — 도메인이 4개를 넘으면 온보딩에서 고른 것만.
  const domains = selectedDomains(allDomains, levels);

  const [picks, quota, originals] = await Promise.all([
    timing.measure("picks", () => getTodayPicks(supabase, user.id, domains, levels, sources)),
    timing.measure("quota", () => getQuota(createAdminClient(), user.id)),
    timing.measure("originals", () => getOriginalPicks(supabase, user.id, allDomains, sources)),
  ]);

  return respond({
    status: "ok",
    picks,
    originals,
    domains: allDomains,
    selectedDomainIds: domains.map(d => d.id),
    quota: {
      remaining: quota.remaining,
      canRead: quota.canRead,
      canUnlockWithAd: quota.canUnlockWithAd,
    },
  });
}

import { getRequestContext, json, preflight } from "@/lib/api";
import { getDomains, getLevels, getTodayPicks, selectedDomains } from "@/lib/feed";
import { getQuota } from "@/lib/quota";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * 오늘 탭 데이터 (앱출시.md §2 — `app/(tabs)/page.tsx`의 서버 쿼리가 여기로 왔다).
 *
 * 쿼터는 여기서도 service role로 읽는다. 클라이언트에는 daily_quota 쓰기 권한이
 * 없고, 따라서 게이트로 신뢰할 만한 읽기 정책도 없기 때문. 게이트 자체는
 * `/api/read/open`이 쥐고 있다 — 이 응답의 canRead는 화면 표시용이다.
 */

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;

export async function GET(request: Request) {
  const { user, supabase } = await getRequestContext(request);

  // 세션이 없거나 수준 행이 없으면 온보딩을 끝내지 않은 것이다. 서버 컴포넌트가
  // redirect()로 하던 판정을, 이제는 클라이언트가 이 값을 보고 한다.
  if (!user) return json(request, { status: "onboarding" });

  const allDomains = await getDomains(supabase);
  const levels = await getLevels(supabase, user.id);
  if (levels.size === 0) return json(request, { status: "onboarding" });

  // 소스분류.md §3 / 정책.md §9 — 도메인이 4개를 넘으면 온보딩에서 고른 것만.
  const domains = selectedDomains(allDomains, levels);

  const [picks, quota] = await Promise.all([
    getTodayPicks(supabase, user.id, domains, levels),
    getQuota(createAdminClient(), user.id),
  ]);

  return json(request, {
    status: "ok",
    picks,
    quota: {
      remaining: quota.remaining,
      canRead: quota.canRead,
      canUnlockWithAd: quota.canUnlockWithAd,
    },
    isGuest: user.is_anonymous === true,
  });
}

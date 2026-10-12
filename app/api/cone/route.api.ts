import { apiError, getRequestContext, json, preflight } from "@/lib/api";
import { getDomains, getScoopMonths, getScoops } from "@/lib/feed";
import { isMonthKey } from "@/lib/day";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * 콘 탭 데이터 (앱출시.md §2 — `app/(tabs)/cone/page.tsx`의 서버 쿼리가 여기로 왔다).
 *
 * 스쿱에 필요한 건 전부 getScoops가 조인해 온다(variantId·title·score). 선택
 * 상태로는 이걸 다시 부르지 않는다 — ConeBoard가 History API로 처리한다.
 */

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;

export async function GET(request: Request) {
  const { user, supabase } = await getRequestContext(request);
  if (!user) return json(request, { status: "onboarding" });

  // 정책.md §1 — 콘 하나 = 한 달. month가 없으면 이번 달.
  const month = new URL(request.url).searchParams.get("month") ?? undefined;
  if (month !== undefined && !isMonthKey(month)) return apiError(request, "invalid month", 400);

  // 본문 공개 권한은 유지하고 본인의 학습 기록만 복원한다.
  // user.id는 검증된 토큰에서 얻는다. 요청에 들어온 userId는 사용하지 않는다.
  const admin = createAdminClient();
  try {
    const [domains, scoops, months] = await Promise.all([
      getDomains(supabase),
      getScoops(admin, user.id, month),
      getScoopMonths(admin, user.id),
    ]);

    return json(request, { status: "ok", domains, scoops, months });
  } catch {
    return apiError(request, "저장한 학습 기록을 불러오지 못했어요.", 503);
  }
}

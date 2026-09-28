import { getRequestContext, json, preflight } from "@/lib/api";
import { getDomains, getScoopMonths, getScoops } from "@/lib/feed";

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

  const [domains, scoops, months] = await Promise.all([
    getDomains(supabase),
    getScoops(supabase, user.id, month),
    getScoopMonths(supabase, user.id),
  ]);

  return json(request, { status: "ok", domains, scoops, months });
}

import { apiError, getRequestContext, json, preflight } from "@/lib/api";
import { getDomains } from "@/lib/feed";
import { getWords } from "@/lib/words";

/**
 * 단어장 탭 데이터 (확장.md §3-1).
 *
 * 콘(`/api/cone`)과 달리 service role을 쓰지 않는다. 단어장은 철회된 글의 기록을
 * 남길 이유가 없으므로(lib/words.ts 머리 주석), 요청자 토큰을 붙인 클라이언트로
 * 읽어 RLS의 본인 행·권리 게이트를 그대로 받고, 그 위에서 articleAllows로 한 번 더
 * 거른다. user.id는 검증된 토큰에서 얻는다 — 요청에 들어온 userId는 쓰지 않는다.
 *
 * 검색과 도메인 필터는 클라이언트가 한다. 한 사람이 모으는 단어가 수백 개 규모라
 * 서버 검색은 필요 없다.
 */

export const dynamic = "force-dynamic";
export const OPTIONS = preflight;

export async function GET(request: Request) {
  const { user, supabase } = await getRequestContext(request);
  if (!user) return json(request, { status: "onboarding" });

  try {
    const [domains, words] = await Promise.all([
      getDomains(supabase),
      getWords(supabase, user.id),
    ]);
    return json(request, { status: "ok", userId: user.id, domains, words });
  } catch {
    return apiError(request, "단어장을 불러오지 못했어요.", 503);
  }
}

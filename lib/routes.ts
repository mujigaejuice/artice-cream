/**
 * 리더·퀴즈 링크 모양 한곳 (앱출시.md §2).
 *
 * 정적 내보내기는 빌드 시점에 아는 경로만 만들 수 있고, variant id는 매일 새로
 * 생긴다. 그래서 `/read/[variantId]`가 아니라 `/read?v=123`이다.
 *
 * 링크를 만드는 자리가 네 군데(주문서 카드·리더 하단 CTA·퀴즈 상단·스쿱 패널)라
 * 모양을 각자 적으면 한 군데만 고치고 지나가기 쉽다. 그래서 함수로 묶었다.
 * `base`는 목데이터 미리보기(`/preview`)가 같은 컴포넌트를 재사용하려고 쓴다.
 */

export function readHref(variantId: number | string, base = ""): string {
  return `${base}/read?v=${variantId}`;
}

export function quizHref(variantId: number | string, base = ""): string {
  return `${base}/read/quiz?v=${variantId}`;
}

/** `safeNext`가 오리진을 재는 기준. 실제로 존재하지 않는 도메인이어야 한다. */
const SAFE_NEXT_BASE = "https://artice.invalid";

/**
 * `next` 파라미터를 내부 경로로만 좁힌다.
 *
 * 값이 URL에서 오므로 그대로 쓰면 열린 리다이렉트가 된다. 딥링크로도 들어오기
 * 때문에(`artice-cream://auth/callback?next=…`) 아무 앱이나 웹 페이지가 만들 수
 * 있는 값이다.
 *
 * 글자를 세는 방식으로는 못 막는다. URL 파서가 파싱 전에 탭·개행·복귀를 지우므로
 * `/<TAB>/host`가 `//host`가 되어 외부 오리진이 된다. 그래서 직접 해석해 보고
 * 오리진이 그대로인 값만 통과시킨다. 통과한 값은 정규화된 경로로 돌려주므로
 * 제어문자도 같이 떨어져 나간다.
 */
export function safeNext(raw: string | null): string {
  if (!raw || !raw.startsWith("/")) return "/";

  try {
    const url = new URL(raw, SAFE_NEXT_BASE);
    if (url.origin !== SAFE_NEXT_BASE) return "/";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/";
  }
}

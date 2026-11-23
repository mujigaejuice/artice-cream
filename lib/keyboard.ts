/**
 * 읽기 → 퀴즈 → 결과 키보드 조작의 키 판정. 컴포넌트는 이 함수들로만 키를 가른다.
 *
 * 한 글자 키(숫자)는 보기 그룹에 포커스가 있을 때만 쓴다(WCAG 2.1.4).
 * 한글 입력 조합 중인 키는 어떤 단축키로도 처리하지 않는다.
 */

type KeyLike = { key: string; metaKey: boolean; ctrlKey: boolean; isComposing?: boolean; keyCode?: number };

/** IME 조합 중인 키. 일부 브라우저는 isComposing 대신 keyCode 229만 준다. */
export function isComposing(event: { isComposing?: boolean; keyCode?: number }): boolean {
  return event.isComposing === true || event.keyCode === 229;
}

const INTERACTIVE = 'a[href], button, input, textarea, select, [role="button"], [role="radio"], [contenteditable="true"]';

/** 포커스가 링크·버튼·입력 위에 있으면 그 요소의 기본 동작을 존중한다. */
export function isInteractiveTarget(target: EventTarget | null): boolean {
  const element = target as Element | null;
  return typeof element?.closest === "function" && element.closest(INTERACTIVE) != null;
}

/** "1"~"9" 중 보기 개수 이하면 0부터 센 인덱스. */
export function digitChoice(key: string, count: number): number | null {
  if (!/^[1-9]$/.test(key)) return null;
  const index = Number(key) - 1;
  return index < count ? index : null;
}

/** ⌘+Enter 또는 Ctrl+Enter. */
export function isPrimaryEnter(event: KeyLike): boolean {
  return event.key === "Enter" && (event.metaKey || event.ctrlKey) && !isComposing(event);
}

/** 조합키 없는 Enter. */
export function isPlainEnter(event: KeyLike & { altKey: boolean; shiftKey: boolean }): boolean {
  return event.key === "Enter" && !event.metaKey && !event.ctrlKey && !event.altKey && !event.shiftKey
    && !isComposing(event);
}

export function modifierLabel(platform: string | undefined): "⌘" | "Ctrl" {
  return platform && /mac|iphone|ipad/i.test(platform) ? "⌘" : "Ctrl";
}

export function currentPlatform(): string | undefined {
  if (typeof navigator === "undefined") return undefined;
  const hinted = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform;
  return hinted || navigator.platform || undefined;
}

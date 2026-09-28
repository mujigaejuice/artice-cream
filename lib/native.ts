"use client";

import { safeNext } from "./routes";

/**
 * 네이티브 경계 (T2 스펙 §6).
 *
 * 앱과 웹이 갈리는 자리를 여기 하나로 모은다. 화면은 자기가 WebView 안에서 도는지
 * 브라우저에서 도는지 모른다.
 *
 * 플러그인은 동적 import로 네이티브에서만 부른다. 웹 번들이 Capacitor에 의존하지
 * 않게 하려는 것이고, lib/supabase/client.ts가 같은 이유로 Preferences를 전역에서
 * 집는다.
 */

/** AndroidManifest의 intent-filter와 같은 값이어야 한다. */
export const AUTH_SCHEME = "artice-cream";
export const AUTH_HOST = "auth";
export const AUTH_DEEP_LINK = `${AUTH_SCHEME}://${AUTH_HOST}/callback`;

/**
 * 로그인에 실패했을 때 돌아가는 자리.
 *
 * `?link=1`이 붙어야 연결 화면으로 간다. 이게 없으면 분야 고르기 첫 화면으로
 * 떨어져서, 사용자는 온보딩을 처음부터 다시 하는 것처럼 본다.
 */
export const AUTH_FAILED_HREF = "/onboarding?link=1&error=auth";

type CapacitorGlobal = { isNativePlatform?: () => boolean };

export function isNative(): boolean {
  const cap = (globalThis as { Capacitor?: CapacitorGlobal }).Capacitor;
  return cap?.isNativePlatform?.() === true;
}

/** OAuth·매직링크가 돌아올 주소. */
export function authRedirectUrl(): string {
  return isNative() ? AUTH_DEEP_LINK : `${window.location.origin}/auth/callback`;
}

/** 로그인 페이지를 연다. 네이티브는 시스템 브라우저, 웹은 같은 탭. */
export async function openExternal(url: string): Promise<void> {
  if (!isNative()) {
    window.location.assign(url);
    return;
  }
  const { Browser } = await import("@capacitor/browser");
  await Browser.open({ url });
}

/** 로그인이 끝난 뒤 시스템 브라우저를 닫는다. 웹에서는 할 일이 없다. */
export async function closeBrowser(): Promise<void> {
  if (!isNative()) return;
  const { Browser } = await import("@capacitor/browser");
  await Browser.close();
}

/**
 * 딥링크에서 code와 next를 꺼낸다. 우리 주소가 아니면 null.
 *
 * 커스텀 스킴도 `//`가 있으면 host가 파싱된다 — `artice-cream://auth/callback`의
 * host는 `auth`, pathname은 `/callback`이다.
 */
export function parseAuthDeepLink(
  url: string,
): { code: string | null; next: string } | null {
  // `new URL()`의 host·pathname에 기대지 않는다. 커스텀 스킴을 엔진마다 다르게
  // 쪼갠다 — 노드는 host="auth" pathname="/callback"으로 보고, 안드로이드
  // WebView는 host="" pathname="//auth/callback"으로 본다. 그 차이에 기대면
  // 노드에서 도는 테스트는 통과하는데 앱에서만 조용히 안 걸린다.
  if (url !== AUTH_DEEP_LINK && !url.startsWith(`${AUTH_DEEP_LINK}?`)) return null;

  const query = url.slice(AUTH_DEEP_LINK.length + 1).split("#")[0];
  const params = new URLSearchParams(url.length > AUTH_DEEP_LINK.length ? query : "");

  // 우리가 시작한 로그인의 응답만 받는다. code도 error도 없는 딥링크는 아무나
  // 쏠 수 있는데, 그걸 처리하면 열려 있던 로그인 브라우저를 닫고 사용자를
  // 온보딩으로 끌어낸다 — 퀴즈를 풀던 중이어도 그렇다.
  const code = params.get("code");
  const failed = params.has("error") || params.has("error_code");
  if (!code && !failed) return null;

  return { code, next: safeNext(params.get("next")) };
}

"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { AUTH_FAILED_HREF, closeBrowser, isNative, parseAuthDeepLink } from "@/lib/native";
import { createClient } from "@/lib/supabase/client";
import { consumeDeletionReturn, deletionAuthFailure } from "@/lib/deletion-return";

/**
 * 딥링크로 돌아온 로그인을 받는다 (T2 스펙 §7).
 *
 * 웹에서는 `/auth/callback` 페이지가 하는 일인데, 앱에서는 그 주소가 WebView 이동이
 * 아니라 `appUrlOpen` 이벤트로 들어온다. 그래서 받는 자리가 따로 있다.
 *
 * 루트 레이아웃에 한 번만 단다. 딥링크는 어느 화면에서든 도착한다.
 *
 * 앱이 죽어 있을 때 온 딥링크는 리스너가 붙기 전에 인텐트가 소비되므로
 * `getLaunchUrl()`로 한 번 더 읽는다. 이게 없으면 콜드 스타트 로그인이 조용히
 * 실패한다.
 */
/**
 * `getLaunchUrl()`은 앱이 살아 있는 동안 같은 URL을 계속 돌려준다. 한 번만 쓰지
 * 않으면 화면을 옮길 때마다 같은 딥링크를 다시 처리해서 제자리로 돌아온다.
 * 모듈 스코프라 클라이언트 라우팅 중에는 유지되고, 콜드 스타트에는 다시 false다.
 */
let launchUrlHandled = false;

export function NativeAuthBridge() {
  const router = useRouter();

  useEffect(() => {
    if (!isNative()) return;

    let remove: (() => void) | undefined;
    let cancelled = false;

    void (async () => {
      const { App } = await import("@capacitor/app");

      const handle = await App.addListener("appUrlOpen", ({ url }) => {
        void handleAuthUrl(url, router);
      });

      // 하드웨어 뒤로 가기. 리스너가 없으면 Capacitor는 히스토리가 있을 때만
      // 뒤로 가고, 없으면 아무 일도 하지 않는다(AppPlugin.java) — 첫 화면에서
      // 뒤로 가기가 먹통이 된다. 안드로이드에서는 그게 앱을 나가는 동작이다.
      const back = await App.addListener("backButton", ({ canGoBack }) => {
        if (canGoBack) router.back();
        else void App.exitApp();
      });

      if (cancelled) {
        void handle.remove();
        void back.remove();
        return;
      }
      remove = () => {
        void handle.remove();
        void back.remove();
      };

      if (launchUrlHandled) return;
      launchUrlHandled = true;

      const launch = await App.getLaunchUrl();
      if (launch?.url && !cancelled) await handleAuthUrl(launch.url, router);
    })();

    return () => {
      cancelled = true;
      remove?.();
    };
  }, [router]);

  return null;
}

async function handleAuthUrl(
  url: string,
  router: { replace: (href: string) => void },
): Promise<void> {
  const link = parseAuthDeepLink(url);
  if (!link) return; // 우리 것이 아닌 딥링크는 지나간다
  const next = consumeDeletionReturn(link.next);
  const failed = deletionAuthFailure(next, AUTH_FAILED_HREF);

  // 기다리지 않는다. 열린 브라우저가 없을 때 Browser.close()가 응답을 안 주면
  // 여기서 멈춰서 화면이 영영 안 바뀐다. 탭이 닫히는 것과 화면을 옮기는 것은
  // 서로 기다릴 필요가 없다.
  void closeBrowser().catch(() => {});

  if (!link.code) {
    router.replace(failed);
    return;
  }

  const supabase = createClient();

  // 던지는 경우를 잡지 않으면 호출자가 void로 삼켜서 화면이 그대로 멈춘다.
  // 사용자는 구글에서 돌아왔는데 연결 화면에 남아 있는 상태가 된다.
  let exchanged = false;
  try {
    const { error } = await supabase.auth.exchangeCodeForSession(link.code);
    exchanged = !error;
  } catch {
    exchanged = false;
  }

  if (exchanged) {
    router.replace(next);
    return;
  }

  // 교환이 실패해도 서버에서는 연결이 끝나 있을 수 있다 — 같은 code를 두 번 받거나,
  // 응답을 받기 전에 연결이 끊긴 경우다. 계정이 실제로 붙었는지로 최종 판정한다.
  //
  // "세션이 있는가"로 재면 안 된다. 게스트 모드를 없애기 전에 만든 익명 세션이
  // 남아 있으면 모든 실패가 성공으로 삼켜진다. 익명이 아닌 사용자인지를 본다.
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    router.replace(user && user.is_anonymous !== true ? next : failed);
  } catch {
    router.replace(failed);
  }
}

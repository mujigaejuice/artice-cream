"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { AUTH_FAILED_HREF } from "@/lib/native";
import { safeNext } from "@/lib/routes";
import { createClient } from "@/lib/supabase/client";

/**
 * OAuth / 매직링크가 돌아오는 자리.
 *
 * Route Handler였다가 클라이언트 페이지가 됐다(앱출시.md §2). 정적 내보내기에는
 * code를 세션 쿠키로 바꿔 줄 서버가 없고, 앱에서는 이 주소가 딥링크
 * (`artice-cream://auth/callback`)로 열린다. PKCE라 교환은 브라우저가 한다 —
 * verifier가 이 클라이언트의 스토리지에만 있기 때문이다.
 */
export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const url = new URL(window.location.href);
    const code = url.searchParams.get("code");

    const next = safeNext(url.searchParams.get("next"));

    if (!code) {
      router.replace(AUTH_FAILED_HREF);
      return;
    }

    void (async () => {
      const supabase = createClient();

      // `detectSessionInUrl: true`라 클라이언트가 만들어질 때 URL의 code를 먼저
      // 교환한다. 그러면 여기서 부르는 교환은 verifier가 이미 소비돼 실패하는데,
      // 세션은 저장된 뒤다. 실패했다고 에러 화면으로 보내면 성공한 로그인이
      // 실패로 보인다. 매직링크를 두 번 눌렀을 때도 같은 모양이다.
      let exchanged = false;
      try {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        exchanged = !error;
      } catch {
        exchanged = false;
      }

      if (exchanged) {
        router.replace(next);
        return;
      }

      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        router.replace(user && user.is_anonymous !== true ? next : AUTH_FAILED_HREF);
      } catch {
        router.replace(AUTH_FAILED_HREF);
      }
    })();
  }, [router]);

  return (
    <main className="py-16 text-center">
      <p role="status" aria-live="polite" className="text-sm text-stone-600">
        로그인 중이에요…
      </p>
    </main>
  );
}

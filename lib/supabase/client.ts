"use client";

import {
  createClient as createSupabaseClient,
  type SupabaseClient,
} from "@supabase/supabase-js";

import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./env";

/**
 * 브라우저·WebView 클라이언트 (앱출시.md §2).
 *
 * 쿠키를 쓰지 않는다. 정적 내보내기에는 세션 쿠키를 읽을 서버가 없고, API는
 * `Authorization: Bearer`로 부른다(lib/api.ts). 그래서 `@supabase/ssr` 대신
 * `@supabase/supabase-js`를 직접 쓰고, 세션은 스토리지 어댑터에 넣는다.
 *
 * PKCE인 이유는 구글 로그인이 시스템 브라우저에서 일어나고 딥링크로 돌아오기
 * 때문이다(앱출시.md §3) — 클라이언트 시크릿을 들고 있을 수 없다.
 */

type PreferencesPlugin = {
  get(options: { key: string }): Promise<{ value: string | null }>;
  set(options: { key: string; value: string }): Promise<void>;
  remove(options: { key: string }): Promise<void>;
};

type CapacitorGlobal = {
  isNativePlatform?: () => boolean;
  Plugins?: { Preferences?: PreferencesPlugin };
};

/**
 * 네이티브에서만 Preferences를 쓴다. WebView의 localStorage는 "앱 데이터 지우기"에
 * 같이 날아가서 로그인이 조용히 풀린다.
 *
 * import하지 않고 런타임 전역에서 집는다 — 웹 번들이 `@capacitor/preferences`에
 * 의존하지 않게 하려고. 웹에는 플러그인이 없고, 있어야 할 이유도 없다.
 */
function nativePreferences(): PreferencesPlugin | null {
  const cap = (globalThis as { Capacitor?: CapacitorGlobal }).Capacitor;
  if (!cap?.isNativePlatform?.()) return null;
  return cap.Plugins?.Preferences ?? null;
}

/**
 * Supabase는 비동기 스토리지를 허용한다. Preferences가 비동기라 그게 필요하다.
 *
 * 프라이빗 창이나 사이트 데이터 차단 상태에서는 localStorage 접근 자체가 throw
 * 하므로 전부 감싼다. 세션이 없는 것은 로그인 화면으로 가면 되는 일이고,
 * 여기서 터지면 앱이 아예 뜨지 않는다.
 */
const sessionStorageAdapter = {
  async getItem(key: string): Promise<string | null> {
    const prefs = nativePreferences();
    if (prefs) {
      try {
        return (await prefs.get({ key })).value;
      } catch {
        return null;
      }
    }
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },

  async setItem(key: string, value: string): Promise<void> {
    const prefs = nativePreferences();
    if (prefs) {
      try {
        await prefs.set({ key, value });
      } catch {
        // 저장하지 못하면 이 세션만 메모리에 남는다. 다음 실행에 다시 로그인한다.
      }
      return;
    }
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // 같은 이유.
    }
  },

  async removeItem(key: string): Promise<void> {
    const prefs = nativePreferences();
    if (prefs) {
      try {
        await prefs.remove({ key });
      } catch {
        // 지우지 못해도 만료된 토큰은 쓸 수 없다.
      }
      return;
    }
    try {
      window.localStorage.removeItem(key);
    } catch {
      // 같은 이유.
    }
  },
};

/**
 * 하나만 만든다. GoTrue 인스턴스가 여러 개면 같은 스토리지 키를 두고 토큰 갱신이
 * 겹쳐 서로의 refresh token을 무효화한다.
 */
let cached: SupabaseClient | null = null;

/** 브라우저 클라이언트. RLS가 허용하는 것만 본다. */
export function createClient(): SupabaseClient {
  if (cached) return cached;

  cached = createSupabaseClient(SUPABASE_URL(), SUPABASE_ANON_KEY(), {
    auth: {
      flowType: "pkce",
      persistSession: true,
      autoRefreshToken: true,
      // 딥링크·매직링크가 code를 URL에 실어 돌아온다 (app/auth/callback).
      detectSessionInUrl: true,
      storage: sessionStorageAdapter,
      storageKey: "artice-auth",
    },
  });

  return cached;
}

/** 다른 기기의 로그인은 유지하고 현재 세션만 종료한다. */
export async function signOutCurrentDevice(): Promise<void> {
  const client = createClient();
  const { error } = await client.auth.signOut({ scope: "local" });
  if (error) throw error;

  // 스토리지 어댑터가 삭제 실패를 삼킬 수 있으므로 성공 안내 전에 확인한다.
  const { data, error: sessionError } = await client.auth.getSession();
  if (sessionError) throw sessionError;
  if (data.session) throw new Error("Session was not cleared");
}

"use client";

import {
  createClient as createSupabaseClient,
  type SupabaseClient,
} from "@supabase/supabase-js";

import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./env";

/**
 * 브라우저 클라이언트.
 *
 * 쿠키를 쓰지 않는다. API는 `Authorization: Bearer`로 부르고(lib/api.ts), 세션은
 * 아래 스토리지 어댑터를 거쳐 localStorage에 둔다. 그래서 `@supabase/ssr` 대신
 * `@supabase/supabase-js`를 직접 쓴다.
 */

/**
 * 프라이빗 창이나 사이트 데이터 차단 상태에서는 localStorage 접근 자체가 throw
 * 하므로 전부 감싼다. 세션이 없는 것은 로그인 화면으로 가면 되는 일이고,
 * 여기서 터지면 앱이 아예 뜨지 않는다.
 */
const sessionStorageAdapter = {
  getItem(key: string): string | null {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },

  setItem(key: string, value: string): void {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // 저장하지 못하면 이 세션만 메모리에 남는다. 다음 방문에 다시 로그인한다.
    }
  },

  removeItem(key: string): void {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // 지우지 못해도 만료된 토큰은 쓸 수 없다. signOutCurrentDevice가 확인한다.
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
      // OAuth·매직링크가 code를 URL에 실어 돌아온다 (app/auth/callback).
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

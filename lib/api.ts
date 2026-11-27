import {
  createClient as createSupabaseClient,
  type SupabaseClient,
  type User,
} from "@supabase/supabase-js";

import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./supabase/env";

/**
 * Route Handler 공용 — 인증과 CORS.
 *
 * 세션이 쿠키가 아니라 브라우저 스토리지에 있으므로(lib/supabase/client.ts) API는
 * `Authorization: Bearer <access token>`으로 인증하며, 쿠키 인증 폴백은 없다.
 *
 * 서버 권위는 그대로다(정책.md §7) — 토큰에서 얻은 user.id로만 쓰고, 클라이언트가
 * 보낸 user id는 어디서도 믿지 않는다.
 */

function allowedOrigins(): string[] {
  const extra = (process.env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const site = process.env.NEXT_PUBLIC_SITE_URL;

  return [
    ...(site ? [site.replace(/\/$/, "")] : []),
    ...extra,
    // 로컬 개발. 프로덕션에서도 열려 있지만 Bearer 토큰이 없으면 아무것도 못 읽는다.
    "http://localhost:3000",
  ];
}

export function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("origin");
  if (!origin || !allowedOrigins().includes(origin)) return {};

  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

/** 프리플라이트. CORS를 쓰는 라우트마다 `export const OPTIONS = preflight`. */
export function preflight(request: Request): Response {
  return new Response(null, { status: 204, headers: corsHeaders(request) });
}

export function json(
  request: Request,
  body: unknown,
  init: { status?: number } = {},
): Response {
  return Response.json(body, {
    status: init.status ?? 200,
    headers: { ...corsHeaders(request), "Cache-Control": "no-store" },
  });
}

/**
 * 응답의 `Server-Timing` 헤더에 구간별 시간(ms)을 싣는다. 브라우저 개발자 도구
 * Network 탭의 응답 헤더나 Timing 탭에서 본다. `total`은 핸들러 시작부터 응답을
 * 만들 때까지이고, 콜드 스타트와 브라우저까지의 통신은 들어가지 않는다.
 */
export function serverTiming() {
  const started = performance.now();
  const entries: string[] = [];
  return {
    async measure<T>(name: string, work: () => PromiseLike<T>): Promise<T> {
      const before = performance.now();
      try { return await work(); }
      finally { entries.push(`${name};dur=${(performance.now() - before).toFixed(1)}`); }
    },
    apply(response: Response): Response {
      response.headers.set("Server-Timing",
        [...entries, `total;dur=${(performance.now() - started).toFixed(1)}`].join(", "));
      return response;
    },
  };
}

export function apiError(
  request: Request,
  message: string,
  status: number,
): Response {
  return json(request, { error: message }, { status });
}

export function bearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header) return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

/**
 * 요청자와, 그 요청자로 RLS가 걸린 Supabase 클라이언트.
 *
 * 둘을 같이 돌려주는 게 중요하다. 토큰으로 사용자를 확인하고 나서 클라이언트를
 * 따로 만들면 토큰을 붙이는 것을 잊기 쉽고, 그러면 `auth.uid()`가 null인 채로
 * 쿼리가 돌아 조용히 빈 결과가 나온다.
 *
 * 토큰이 없거나 익명 사용자면 `user`는 null이다. 그래도 200을 주는 라우트가
 * 하나 있다 — `/api/onboarding`. `domains`와 `domain_terms`는 RLS가 전체 읽기를
 * 허용하고, 로그인 화면이 거기 있기 때문이다.
 */
export async function getRequestContext(
  request: Request,
): Promise<{ user: User | null; supabase: SupabaseClient }> {
  const token = bearerToken(request);

  const supabase = createSupabaseClient(SUPABASE_URL(), SUPABASE_ANON_KEY(), {
    auth: { persistSession: false, autoRefreshToken: false },
    ...(token
      ? { global: { headers: { Authorization: `Bearer ${token}` } } }
      : {}),
  });

  if (!token) return { user: null, supabase };

  const { data } = await supabase.auth.getUser(token);
  return { user: signedInUser(data.user), supabase };
}

/**
 * 익명 사용자는 로그인하지 않은 것으로 본다.
 *
 * 처음부터 로그인을 받도록 바꾸면서(2026-10-04) 게스트 모드를 없앴다. 그 전에
 * 만든 익명 세션은 브라우저에 남아 토큰이 계속 갱신되므로, 판정은 서버가 쥔다.
 * 그런 사용자는 온보딩의 로그인 화면으로 가고, 거기서 세션이 정리된다.
 */
export function signedInUser(user: User | null): User | null {
  return user && user.is_anonymous !== true ? user : null;
}

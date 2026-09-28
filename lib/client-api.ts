"use client";

import { createClient } from "./supabase/client";

/**
 * 클라이언트에서 Vercel API를 부르는 자리 (앱출시.md §2).
 *
 * 앱 번들은 정적 자산이라 API와 오리진이 다르다. `NEXT_PUBLIC_API_BASE`가 그
 * 주소이고, 웹에서는 비어 있어 같은 오리진을 부른다.
 *
 * 쿠키가 없으니 토큰을 매번 붙인다. `getSession()`은 필요하면 갱신까지 해 주므로
 * 만료된 토큰으로 401을 받는 일이 없다.
 */

const BASE = (process.env.NEXT_PUBLIC_API_BASE ?? "").replace(/\/$/, "");

export async function apiFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const headers = new Headers(init.headers);
  if (session?.access_token) {
    headers.set("Authorization", `Bearer ${session.access_token}`);
  }
  if (init.body != null && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  return fetch(`${BASE}${path}`, { ...init, headers });
}

/** 잘못된 응답을 호출자가 조용히 무시하지 못하게 여기서 던진다. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function apiJson<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const res = await apiFetch(path, init);

  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      if (typeof body?.error === "string") message = body.error;
    } catch {
      // 본문이 JSON이 아니면 상태 코드만 남는다.
    }
    throw new ApiError(res.status, message);
  }

  return (await res.json()) as T;
}

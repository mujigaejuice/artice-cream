import type { NextConfig } from "next";

/**
 * 한 레포에서 두 개가 나간다 (앱출시.md §2).
 *
 *   기본            → Vercel. `app/api/*`와 cron. 인제스트·채점·쿼터가 여기 남는다.
 *   APP_EXPORT=1    → 앱 번들. `output: 'export'`로 만든 정적 자산을 Capacitor가 안고 간다.
 *
 * 차이는 두 줄뿐이다.
 *
 * `pageExtensions`가 API 라우트를 가른다. Route Handler는 Request에 의존하므로
 * `output: 'export'`가 지원하지 않는다 — 그러니 앱 빌드에서는 아예 없어야 한다.
 * 파일을 빌드 중에 옮기는 스크립트는 중간에 죽으면 트리를 망가진 채로 남기니까,
 * 대신 라우트 파일 이름을 `route.api.ts`로 두고 확장자를 빌드마다 켜고 끈다.
 * 앱 빌드에는 `api.ts`가 없으므로 `route.api.ts`는 라우트로 잡히지 않는다.
 *
 * `trailingSlash`는 `out/read/index.html`을 만들기 위한 것이다. Capacitor의
 * 로컬 서버는 `/read` → `read.html` 확장자 폴백을 해 주지 않는다.
 */
const isAppExport = process.env.APP_EXPORT === "1";

const nextConfig: NextConfig = {
  // Readability + jsdom only ever run on the server (cron route, spikes).
  serverExternalPackages: ["jsdom", "@mozilla/readability"],

  pageExtensions: isAppExport
    ? ["tsx", "ts", "jsx", "js"]
    : ["tsx", "ts", "jsx", "js", "api.ts"],

  ...(isAppExport ? { output: "export" as const, trailingSlash: true } : {}),
};

export default nextConfig;

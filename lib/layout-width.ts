/** Routes whose frame widens to the laptop layout (≥1024px); everything else stays a centered column. */
const WIDE_ROUTES = new Set(["/", "/cone", "/read", "/preview/today", "/preview/read"]);

function normalize(pathname: string): string {
  return pathname.replace(/\/+$/, "") || "/";
}

export function isWideRoute(pathname: string | null): boolean {
  return pathname != null && WIDE_ROUTES.has(normalize(pathname));
}

/** Pre-login flows show only the logo and music button in the top bar. */
export function isBareHeaderRoute(pathname: string | null): boolean {
  if (pathname == null) return false;
  const path = normalize(pathname);
  return ["/onboarding", "/auth"].some(base => path === base || path.startsWith(`${base}/`));
}

"use client";

const KEY = "artice-delete-return";
export const ACCOUNT_DELETE_PATH = "/account/delete/";

/** Keep the already-allowlisted OAuth/PKCE callback URL unchanged. No credentials stored. */
export function rememberDeletionReturn(): void {
  window.localStorage.setItem(KEY, String(Date.now()));
}

export function clearDeletionReturn(): void {
  try { window.localStorage.removeItem(KEY); } catch { /* no return hint */ }
}

export function consumeDeletionReturn(fallback: string): string {
  try {
    const value = window.localStorage.getItem(KEY);
    window.localStorage.removeItem(KEY);
    const age = Date.now() - Number(value);
    if (value && age >= 0 && age <= 60 * 60 * 1000) return ACCOUNT_DELETE_PATH;
  } catch { /* the user can reopen the public deletion page */ }
  return fallback;
}

export function deletionAuthFailure(next: string, fallback: string): string {
  return next === ACCOUNT_DELETE_PATH ? `${ACCOUNT_DELETE_PATH}?error=auth` : fallback;
}

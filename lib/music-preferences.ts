import { isNative } from "./native";

export const MUSIC_PREFERENCE_KEY = "artice-cream:bgm:v1";
let pendingWrite = Promise.resolve();

function parse(value: string | null): boolean {
  try { return JSON.parse(value ?? "null")?.enabled === true; }
  catch { return false; }
}

export async function readMusicPreference(): Promise<boolean> {
  let fallback: string | null = null;
  try { fallback = window.localStorage.getItem(MUSIC_PREFERENCE_KEY); } catch { /* Optional storage. */ }
  if (isNative()) {
    try {
      const { Preferences } = await import("@capacitor/preferences");
      const { value } = await Preferences.get({ key: MUSIC_PREFERENCE_KEY });
      return parse(value ?? fallback);
    } catch { /* Keep the browser fallback when the native bridge is unavailable. */ }
  }
  return parse(fallback);
}

export function writeMusicPreference(enabled: boolean): void {
  const value = JSON.stringify({ enabled });
  try { window.localStorage.setItem(MUSIC_PREFERENCE_KEY, value); } catch { /* Playback still works. */ }
  if (!isNative()) return;
  // Preserve the last choice even when native writes finish out of order.
  pendingWrite = pendingWrite.then(async () => {
    const { Preferences } = await import("@capacitor/preferences");
    await Preferences.set({ key: MUSIC_PREFERENCE_KEY, value });
  }).catch(() => {});
}

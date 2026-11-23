export const MUSIC_PREFERENCE_KEY = "artice-cream:bgm:v1";

function parse(value: string | null): boolean {
  try { return JSON.parse(value ?? "null")?.enabled === true; }
  catch { return false; }
}

export async function readMusicPreference(): Promise<boolean> {
  try { return parse(window.localStorage.getItem(MUSIC_PREFERENCE_KEY)); }
  catch { return false; /* Optional storage. */ }
}

export function writeMusicPreference(enabled: boolean): void {
  try { window.localStorage.setItem(MUSIC_PREFERENCE_KEY, JSON.stringify({ enabled })); }
  catch { /* Playback still works. */ }
}

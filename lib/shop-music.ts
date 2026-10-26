/** Static music files shipped with both the web site and the Android bundle. */
export const DEFAULT_MUSIC_SOURCE = "/audio/ice-cream-basic.mp3";
export const MUSIC_TRACKS = {
  "one-scoop-of-joy": { source: "/audio/one-scoop-of-joy.mp3", color: "#D986A8", light: "#F8DDE8" },
  "tiptoe-into-sunlight": { source: "/audio/tiptoe-into-sunlight.mp3", color: "#D19B43", light: "#F7E9BE" },
  "two-scoops-of-july": { source: "/audio/two-scoops-of-july.mp3", color: "#719FA6", light: "#D9EDEF" },
  "waffle-cone-waltz": { source: "/audio/waffle-cone-waltz.mp3", color: "#916D4F", light: "#F2DFC5" },
} as const;

export type MusicKey = keyof typeof MUSIC_TRACKS;

export function isMusicKey(value: unknown): value is MusicKey {
  return typeof value === "string" && Object.hasOwn(MUSIC_TRACKS, value);
}

export function musicSource(key: unknown): string {
  return isMusicKey(key) ? MUSIC_TRACKS[key].source : DEFAULT_MUSIC_SOURCE;
}

export const MUSIC_EQUIPPED_EVENT = "artice:music-equipped";
export const MUSIC_PREVIEW_EVENT = "artice:music-preview";

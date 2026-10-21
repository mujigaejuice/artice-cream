// Keep the unlocked audio context across the result → cone client navigation.
let context: AudioContext | null = null;

/** Call directly from the save click, before any network await. */
export function prepareScoopSound(): void {
  try {
    const Audio = window.AudioContext ?? (window as typeof window & {
      webkitAudioContext?: typeof AudioContext;
    }).webkitAudioContext;
    if (!Audio) return;
    if (!context || context.state === "closed") context = new Audio();
    if (context.state === "suspended") void context.resume().catch(() => {});
  } catch {
    // Audio is optional; a blocked audio device must never block saving.
  }
}

/** A soft, short plop, generated locally with no asset download. */
export function playScoopSound(): void {
  if (!context || context.state !== "running" || document.hidden) return;
  try {
    const tone = context.createOscillator();
    const volume = context.createGain();
    const now = context.currentTime;
    tone.type = "sine";
    tone.frequency.setValueAtTime(520, now);
    tone.frequency.exponentialRampToValueAtTime(180, now + 0.14);
    volume.gain.setValueAtTime(0, now);
    volume.gain.linearRampToValueAtTime(0.16, now + 0.008);
    volume.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    tone.connect(volume);
    volume.connect(context.destination);
    tone.onended = () => { tone.disconnect(); volume.disconnect(); };
    tone.start(now);
    tone.stop(now + 0.2);
  } catch {
    // Continue the visual feedback when sound is unavailable.
  }
}

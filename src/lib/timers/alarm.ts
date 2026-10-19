// Timer alarm: a soft, synthesized double-beep (Web Audio, no audio files) plus vibration.
// Browsers only allow audio after a user gesture, so unlockAudio() must run inside the tap
// that starts a timer; the same AudioContext can then ring minutes later.

type AudioSessionType = "auto" | "playback" | "transient" | "transient-solo" | "ambient" | "play-and-record";
type NavigatorWithAudioSession = Navigator & { audioSession?: { type: AudioSessionType } };
type WindowWithWebkitAudio = Window & { webkitAudioContext?: typeof AudioContext };

const RING_EVERY_MS = 1600;
const MAX_RING_MS = 60_000;

let context: AudioContext | null = null;
let ringInterval: number | null = null;
let stopTimeout: number | null = null;
let ringing = false;
const listeners = new Set<() => void>();

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (context) return context;
  const Ctor = window.AudioContext ?? (window as WindowWithWebkitAudio).webkitAudioContext;
  if (!Ctor) return null;
  try {
    context = new Ctor();
  } catch {
    context = null;
  }
  return context;
}

function setAudioSession(type: AudioSessionType): void {
  // iOS 17+: "playback" keeps the alarm audible with the ring/silent switch on.
  const session = (navigator as NavigatorWithAudioSession).audioSession;
  if (!session) return;
  try {
    session.type = type;
  } catch {
    // Read-only or unsupported value: ignore.
  }
}

/** Call synchronously inside a tap. Creates/resumes the AudioContext so it may play later. */
export function unlockAudio(): void {
  const ctx = getContext();
  if (!ctx) return;
  if (ctx.state === "suspended") void ctx.resume().catch(() => undefined);
  try {
    // A silent one-sample buffer completes the unlock on older iOS versions.
    const source = ctx.createBufferSource();
    source.buffer = ctx.createBuffer(1, 1, 22_050);
    source.connect(ctx.destination);
    source.start(0);
  } catch {
    // ignore
  }
}

function tone(ctx: AudioContext, at: number, frequency: number): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(frequency, at);
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(0.32, at + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.24);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(at);
  osc.stop(at + 0.26);
}

function ringOnce(sound: boolean, vibrate: boolean): void {
  if (sound) {
    const ctx = getContext();
    if (ctx) {
      if (ctx.state === "suspended") void ctx.resume().catch(() => undefined);
      const t = ctx.currentTime + 0.03;
      tone(ctx, t, 880); // A5
      tone(ctx, t + 0.3, 1174.66); // D6 — a gentle rising pair
    }
  }
  if (vibrate && typeof navigator.vibrate === "function") navigator.vibrate([180, 120, 180]);
}

function emit(): void {
  listeners.forEach((l) => l());
}

/** Rings until stopAlarm() or for 60 s. */
export function startAlarm({ sound, vibrate }: { sound: boolean; vibrate: boolean }): void {
  if (typeof window === "undefined" || (!sound && !vibrate)) return;
  stopAlarm();
  if (sound) setAudioSession("playback");
  ringOnce(sound, vibrate);
  ringInterval = window.setInterval(() => ringOnce(sound, vibrate), RING_EVERY_MS);
  stopTimeout = window.setTimeout(stopAlarm, MAX_RING_MS);
  ringing = true;
  emit();
}

export function stopAlarm(): void {
  if (ringInterval != null) window.clearInterval(ringInterval);
  if (stopTimeout != null) window.clearTimeout(stopTimeout);
  ringInterval = null;
  stopTimeout = null;
  if (!ringing) return;
  ringing = false;
  if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") navigator.vibrate(0);
  setAudioSession("auto");
  emit();
}

export function isAlarmRinging(): boolean {
  return ringing;
}

export function subscribeAlarm(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

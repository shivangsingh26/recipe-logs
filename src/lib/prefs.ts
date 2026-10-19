// Device preferences (theme, timer feedback, …) live in localStorage: they are tiny,
// must be readable synchronously before first paint (theme), and are not part of backups.

import { useSyncExternalStore } from "react";
import { STORAGE_KEYS } from "./storageKeys";

export type ThemePref = "system" | "light" | "dark";

export interface Prefs {
  theme: ThemePref;
  /** Play an alarm sound when a timer finishes. */
  timerSound: boolean;
  /** Vibrate (where supported, i.e. Android) when a timer finishes. */
  timerVibrate: boolean;
  /** Keep the screen awake while timers run or a recipe is open in cook mode. */
  keepAwake: boolean;
  /** First day of the week in the calendar: 0 = Sunday, 1 = Monday. */
  weekStartsOn: 0 | 1;
  /** When the last export/backup was made (epoch ms). */
  lastBackupAt: number | null;
}

export const PREFS_STORAGE_KEY = STORAGE_KEYS.prefs;

export const DEFAULT_PREFS: Prefs = {
  theme: "system",
  timerSound: true,
  timerVibrate: true,
  keepAwake: true,
  weekStartsOn: 1,
  lastBackupAt: null,
};

function sanitize(raw: unknown): Prefs {
  const p = raw && typeof raw === "object" ? (raw as Partial<Record<keyof Prefs, unknown>>) : {};
  return {
    theme: p.theme === "light" || p.theme === "dark" || p.theme === "system" ? p.theme : DEFAULT_PREFS.theme,
    timerSound: typeof p.timerSound === "boolean" ? p.timerSound : DEFAULT_PREFS.timerSound,
    timerVibrate: typeof p.timerVibrate === "boolean" ? p.timerVibrate : DEFAULT_PREFS.timerVibrate,
    keepAwake: typeof p.keepAwake === "boolean" ? p.keepAwake : DEFAULT_PREFS.keepAwake,
    weekStartsOn: p.weekStartsOn === 0 || p.weekStartsOn === 1 ? p.weekStartsOn : DEFAULT_PREFS.weekStartsOn,
    lastBackupAt:
      typeof p.lastBackupAt === "number" && Number.isFinite(p.lastBackupAt) ? p.lastBackupAt : DEFAULT_PREFS.lastBackupAt,
  };
}

let cache: Prefs | null = null;
const listeners = new Set<() => void>();

export function getPrefs(): Prefs {
  if (cache) return cache;
  if (typeof window === "undefined") return DEFAULT_PREFS;
  try {
    cache = sanitize(JSON.parse(window.localStorage.getItem(PREFS_STORAGE_KEY) ?? "null"));
  } catch {
    cache = { ...DEFAULT_PREFS };
  }
  return cache;
}

export function setPrefs(patch: Partial<Prefs>): void {
  cache = sanitize({ ...getPrefs(), ...patch });
  try {
    window.localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(cache));
  } catch {
    // Storage full or blocked (private mode): keep the in-memory value for this session.
  }
  listeners.forEach((l) => l());
}

export function subscribePrefs(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === PREFS_STORAGE_KEY) {
      cache = null;
      listener();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** Reactive preferences (defaults during prerender, real values after hydration). */
export function usePrefs(): Prefs {
  return useSyncExternalStore(subscribePrefs, getPrefs, () => DEFAULT_PREFS);
}

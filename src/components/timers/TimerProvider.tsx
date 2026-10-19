"use client";

// Kitchen timers for the whole app: persisted state, a 250 ms clock that only ticks while a
// timer runs, and the finish alert (alarm, vibration, toast, background notification).
// Also keeps the screen awake while timers run (per the keep-awake preference).

import { useRouter } from "next/navigation";
import { useEffect, useEffectEvent, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { useToast } from "@/components/ui/Toast";
import { withBasePath } from "@/lib/basePath";
import { newId } from "@/lib/ids";
import { usePrefs } from "@/lib/prefs";
import { STORAGE_KEYS } from "@/lib/storageKeys";
import { startAlarm, stopAlarm, unlockAudio } from "@/lib/timers/alarm";
import { finishedAgo } from "@/lib/timers/labels";
import { showTimerNotification } from "@/lib/timers/notify";
import {
  createTimerStore,
  type KitchenTimer,
  type StartAction,
  type StartTimerInput,
  type TimerStore,
} from "@/lib/timers/store";
import { useWakeLock } from "@/lib/wakeLock";

const EMPTY: readonly KitchenTimer[] = [];
const TICK_MS = 250;
/** Timers that finished longer ago than this (app closed) alert silently. */
const RING_WINDOW_MS = 60_000;

let store: TimerStore | null = null;
let clockNow = 0;
const clockListeners = new Set<() => void>();

function bumpClock(): void {
  clockNow = Date.now();
  clockListeners.forEach((listener) => listener());
}

function getStore(): TimerStore {
  if (!store) {
    let storage: Storage | null = null;
    try {
      storage = window.localStorage;
    } catch {
      storage = null; // Blocked storage (private mode): timers still work in memory.
    }
    store = createTimerStore({ now: Date.now, newId, storage, storageKey: STORAGE_KEYS.timers });
    // Registered first, so countdowns are fresh in the same render as any timer change.
    store.subscribe(bumpClock);
    clockNow = Date.now();
  }
  return store;
}

const subscribeTimers = (listener: () => void) => getStore().subscribe(listener);
const getTimers = () => getStore().getSnapshot();
const getServerTimers = () => EMPTY;

function subscribeClock(listener: () => void): () => void {
  clockListeners.add(listener);
  return () => clockListeners.delete(listener);
}
function getClock(): number {
  if (!clockNow) clockNow = Date.now();
  return clockNow;
}
const getServerClock = () => 0;

export interface TimerActions {
  /** Starts a timer, or toggles pause/resume when one with the same key exists. Call from a tap. */
  start(input: StartTimerInput): { timer: KitchenTimer; action: StartAction };
  pause(id: string): void;
  resume(id: string): void;
  /** Adds time (default 1 minute); a finished timer runs again. */
  addTime(id: string, ms?: number): void;
  restart(id: string): void;
  dismiss(id: string): void;
  dismissAllDone(): void;
  /** Stops the alarm sound/vibration without changing any timer. */
  silence(): void;
}

// Taps that (re)start a timer also unlock audio, so the alarm can play when it ends.
const actions: TimerActions = {
  start(input) {
    unlockAudio();
    return getStore().start(input);
  },
  pause: (id) => getStore().pause(id),
  resume(id) {
    unlockAudio();
    getStore().resume(id);
  },
  addTime(id, ms = 60_000) {
    unlockAudio();
    getStore().addTime(id, ms);
  },
  restart(id) {
    unlockAudio();
    getStore().restart(id);
  },
  dismiss: (id) => getStore().dismiss(id),
  dismissAllDone: () => getStore().dismissAllDone(),
  silence: stopAlarm,
};

export interface UseTimersResult extends TimerActions {
  timers: readonly KitchenTimer[];
}

/** All timers (reactive) plus the timer actions. */
export function useTimers(): UseTimersResult {
  const timers = useSyncExternalStore(subscribeTimers, getTimers, getServerTimers);
  return useMemo(() => ({ timers, ...actions }), [timers]);
}

/** The timer actions alone (never re-renders). */
export function useTimerActions(): TimerActions {
  return actions;
}

/** Current time, updated every 250 ms while a timer runs (0 during prerender). */
export function useTimerNow(): number {
  return useSyncExternalStore(subscribeClock, getClock, getServerClock);
}

export function recipeTimerHref(recipeId: string): string {
  return `/recipe/?id=${encodeURIComponent(recipeId)}`;
}

export function TimerProvider({ children }: { children: ReactNode }) {
  const timers = useSyncExternalStore(subscribeTimers, getTimers, getServerTimers);
  const prefs = usePrefs();
  const toast = useToast();
  const router = useRouter();
  const hasRunning = timers.some((t) => t.status === "running");
  const hasDone = timers.some((t) => t.status === "done");

  useWakeLock(prefs.keepAwake && hasRunning);

  const alertFinished = useEffectEvent((finished: readonly KitchenTimer[]) => {
    if (!finished.length) return;
    const now = Date.now();
    if (finished.some((t) => now - (t.doneAt ?? now) < RING_WINDOW_MS)) {
      startAlarm({ sound: prefs.timerSound, vibrate: prefs.timerVibrate });
    }
    for (const timer of finished) {
      const elapsed = now - (timer.doneAt ?? now);
      const title = `${timer.detail ? `${timer.detail} timer` : "Timer"} done`;
      toast.show({
        id: `timer-${timer.id}`,
        title: elapsed >= RING_WINDOW_MS ? `Timer finished ${finishedAgo(elapsed)}` : title,
        description: timer.label,
        duration: 8000,
        action: {
          label: "Stop",
          onClick: () => {
            stopAlarm();
            getStore().dismiss(timer.id);
          },
        },
      });
      if (document.visibilityState === "hidden") {
        const href = timer.recipeId ? recipeTimerHref(timer.recipeId) : "/";
        void showTimerNotification({
          tag: `timer-${timer.id}`,
          title,
          body: timer.label,
          url: withBasePath(href),
          onClick: () => router.push(href),
        });
      }
    }
    getStore().markAlerted(finished.map((t) => t.id));
  });

  // One interval, only while something runs. Remaining time is derived from Date.now().
  useEffect(() => {
    if (!hasRunning) return;
    const id = window.setInterval(() => {
      bumpClock();
      alertFinished(getStore().tick());
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [hasRunning]);

  // Catch up after a reload or when the app comes back: alert timers that ended meanwhile.
  useEffect(() => {
    const catchUp = () => {
      getStore().tick();
      bumpClock();
      alertFinished(getStore().getSnapshot().filter((t) => t.status === "done" && !t.alerted));
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") catchUp();
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEYS.timers) getStore().reload();
    };
    catchUp();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("storage", onStorage);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  // Nothing left to ring for (stopped, dismissed or snoozed): silence the alarm.
  useEffect(() => {
    if (!hasDone) stopAlarm();
  }, [hasDone]);

  return <>{children}</>;
}

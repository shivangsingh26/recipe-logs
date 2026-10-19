// Kitchen timers. The transitions are pure functions of (timers, now) so they are easy to
// test; createTimerStore() wraps them in a tiny external store for useSyncExternalStore,
// persisted to localStorage so timers survive reloads and app switches. Remaining time is
// always derived from the clock (endsAt − now), never counted down, so background
// throttling cannot make a timer drift.

export type TimerStatus = "running" | "paused" | "done";

export interface KitchenTimer {
  id: string;
  /** Identity of the timer source: recipeId + stepId + seconds. */
  key: string;
  /** "Step 3 · Kacchi Chicken Dum Biryani" */
  label: string;
  /** The phrase that started it, e.g. "14 min" or "5–6 min". */
  detail: string;
  recipeId?: string;
  stepId?: string;
  durationMs: number;
  status: TimerStatus;
  /** Epoch ms a running timer rings at; null otherwise. */
  endsAt: number | null;
  /** Time left while paused. */
  remainingMs: number;
  /** When it finished (epoch ms). */
  doneAt?: number;
  /** The finish alert (sound, toast, notification) has fired. */
  alerted: boolean;
  createdAt: number;
}

export interface StartTimerInput {
  key?: string;
  label: string;
  detail?: string;
  durationMs: number;
  recipeId?: string;
  stepId?: string;
}

export type StartAction = "started" | "paused" | "resumed" | "restarted";

export const MAX_TIMERS = 12;
/** Finished timers older than this are dropped on load. */
const STALE_DONE_MS = 12 * 60 * 60 * 1000;

export function timerKey(recipeId: string | undefined, stepId: string | undefined, seconds: number): string {
  return `${recipeId ?? ""}:${stepId ?? ""}:${Math.round(seconds)}`;
}

export function remainingMs(timer: KitchenTimer, now: number): number {
  if (timer.status === "running") return Math.max(0, (timer.endsAt ?? now) - now);
  if (timer.status === "paused") return Math.max(0, timer.remainingMs);
  return 0;
}

function replace(timers: readonly KitchenTimer[], id: string, update: (t: KitchenTimer) => KitchenTimer): KitchenTimer[] {
  let changed = false;
  const next = timers.map((t) => {
    if (t.id !== id) return t;
    const updated = update(t);
    if (updated !== t) changed = true;
    return updated;
  });
  return changed ? next : (timers as KitchenTimer[]);
}

function running(timer: KitchenTimer, ms: number, now: number): KitchenTimer {
  return { ...timer, status: "running", endsAt: now + ms, remainingMs: ms, doneAt: undefined, alerted: false };
}

export function pauseTimer(timers: readonly KitchenTimer[], id: string, now: number): KitchenTimer[] {
  return replace(timers, id, (t) =>
    t.status === "running" ? { ...t, status: "paused", remainingMs: remainingMs(t, now), endsAt: null } : t,
  );
}

export function resumeTimer(timers: readonly KitchenTimer[], id: string, now: number): KitchenTimer[] {
  return replace(timers, id, (t) => (t.status === "paused" ? running(t, t.remainingMs, now) : t));
}

export function restartTimer(timers: readonly KitchenTimer[], id: string, now: number): KitchenTimer[] {
  return replace(timers, id, (t) => running(t, t.durationMs, now));
}

/** +1 min style extension. A finished timer starts running again for `ms`. */
export function addTime(timers: readonly KitchenTimer[], id: string, ms: number, now: number): KitchenTimer[] {
  if (!(ms > 0)) return timers as KitchenTimer[];
  return replace(timers, id, (t) => {
    if (t.status === "running") return { ...t, endsAt: (t.endsAt ?? now) + ms, durationMs: t.durationMs + ms };
    if (t.status === "paused") return { ...t, remainingMs: t.remainingMs + ms, durationMs: t.durationMs + ms };
    return { ...running(t, ms, now), durationMs: ms };
  });
}

export function dismissTimer(timers: readonly KitchenTimer[], id: string): KitchenTimer[] {
  return timers.some((t) => t.id === id) ? timers.filter((t) => t.id !== id) : (timers as KitchenTimer[]);
}

export function dismissAllDone(timers: readonly KitchenTimer[]): KitchenTimer[] {
  return timers.some((t) => t.status === "done") ? timers.filter((t) => t.status !== "done") : (timers as KitchenTimer[]);
}

/**
 * Starts a timer — or, when one with the same key exists, toggles it instead of
 * duplicating: running → paused, paused → resumed, done → restarted.
 */
export function startTimer(
  timers: readonly KitchenTimer[],
  input: StartTimerInput,
  now: number,
  id: string,
): { timers: KitchenTimer[]; timer: KitchenTimer; action: StartAction } {
  const key = input.key ?? timerKey(input.recipeId, input.stepId, Math.round(input.durationMs / 1000));
  const existing = timers.find((t) => t.key === key);
  if (existing) {
    const action: StartAction =
      existing.status === "running" ? "paused" : existing.status === "paused" ? "resumed" : "restarted";
    const next =
      action === "paused"
        ? pauseTimer(timers, existing.id, now)
        : action === "resumed"
          ? resumeTimer(timers, existing.id, now)
          : restartTimer(timers, existing.id, now);
    return { timers: next, timer: next.find((t) => t.id === existing.id) ?? existing, action };
  }
  const durationMs = Math.max(1000, Math.round(input.durationMs));
  const timer: KitchenTimer = {
    id,
    key,
    label: input.label,
    detail: input.detail ?? "",
    ...(input.recipeId ? { recipeId: input.recipeId } : {}),
    ...(input.stepId ? { stepId: input.stepId } : {}),
    durationMs,
    status: "running",
    endsAt: now + durationMs,
    remainingMs: durationMs,
    alerted: false,
    createdAt: now,
  };
  // Oldest finished timers make room first when the list is full.
  let list = [...timers, timer];
  while (list.length > MAX_TIMERS) {
    const doneIndex = list.findIndex((t) => t.status === "done");
    list = list.filter((_, i) => i !== (doneIndex >= 0 ? doneIndex : 0));
  }
  return { timers: list, timer, action: "started" };
}

/** Marks running timers whose end time has passed as done; returns the ones that just finished. */
export function settleTimers(
  timers: readonly KitchenTimer[],
  now: number,
): { timers: KitchenTimer[]; finished: KitchenTimer[] } {
  const finished: KitchenTimer[] = [];
  const next = timers.map((t) => {
    if (t.status !== "running" || t.endsAt == null || t.endsAt > now) return t;
    const done: KitchenTimer = { ...t, status: "done", remainingMs: 0, doneAt: t.endsAt, endsAt: null };
    finished.push(done);
    return done;
  });
  return { timers: finished.length ? next : (timers as KitchenTimer[]), finished };
}

export function markAlerted(timers: readonly KitchenTimer[], ids: readonly string[]): KitchenTimer[] {
  const set = new Set(ids);
  if (!timers.some((t) => set.has(t.id) && !t.alerted)) return timers as KitchenTimer[];
  return timers.map((t) => (set.has(t.id) && !t.alerted ? { ...t, alerted: true } : t));
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/** Validates timers read back from storage; drops anything malformed or long finished. */
export function sanitizeTimers(value: unknown, now: number): KitchenTimer[] {
  if (!Array.isArray(value)) return [];
  const out: KitchenTimer[] = [];
  const seen = new Set<string>();
  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const t = raw as Record<string, unknown>;
    const status = t.status;
    if (status !== "running" && status !== "paused" && status !== "done") continue;
    if (typeof t.id !== "string" || !t.id || seen.has(t.id) || typeof t.key !== "string") continue;
    if (!isFiniteNumber(t.durationMs) || t.durationMs <= 0) continue;
    if (status === "running" && !isFiniteNumber(t.endsAt)) continue;
    const doneAt = isFiniteNumber(t.doneAt) ? t.doneAt : undefined;
    if (status === "done" && now - (doneAt ?? 0) > STALE_DONE_MS) continue;
    seen.add(t.id);
    out.push({
      id: t.id,
      key: t.key,
      label: typeof t.label === "string" ? t.label.slice(0, 200) : "Timer",
      detail: typeof t.detail === "string" ? t.detail.slice(0, 60) : "",
      ...(typeof t.recipeId === "string" && t.recipeId ? { recipeId: t.recipeId } : {}),
      ...(typeof t.stepId === "string" && t.stepId ? { stepId: t.stepId } : {}),
      durationMs: t.durationMs,
      status,
      endsAt: status === "running" ? (t.endsAt as number) : null,
      remainingMs: isFiniteNumber(t.remainingMs) ? Math.max(0, t.remainingMs) : 0,
      ...(doneAt != null ? { doneAt } : {}),
      alerted: t.alerted === true,
      createdAt: isFiniteNumber(t.createdAt) ? t.createdAt : now,
    });
  }
  return out.slice(-MAX_TIMERS);
}

export type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export interface TimerStoreDeps {
  now: () => number;
  newId: () => string;
  storage?: StorageLike | null;
  storageKey?: string;
}

export interface TimerStore {
  getSnapshot(): readonly KitchenTimer[];
  subscribe(listener: () => void): () => void;
  start(input: StartTimerInput): { timer: KitchenTimer; action: StartAction };
  pause(id: string): void;
  resume(id: string): void;
  addTime(id: string, ms: number): void;
  restart(id: string): void;
  dismiss(id: string): void;
  dismissAllDone(): void;
  /** Settles finished timers; returns those that just finished. */
  tick(): KitchenTimer[];
  markAlerted(ids: readonly string[]): void;
  /** Re-reads storage (another tab changed the timers). */
  reload(): void;
}

export function createTimerStore({ now, newId, storage = null, storageKey = "timers" }: TimerStoreDeps): TimerStore {
  const listeners = new Set<() => void>();

  const read = (): KitchenTimer[] => {
    try {
      const raw = storage?.getItem(storageKey);
      return raw ? sanitizeTimers(JSON.parse(raw), now()) : [];
    } catch {
      return [];
    }
  };

  const write = (list: readonly KitchenTimer[]) => {
    try {
      if (list.length) storage?.setItem(storageKey, JSON.stringify(list));
      else storage?.removeItem(storageKey);
    } catch {
      // Storage full or blocked: timers still work for this session.
    }
  };

  // Timers that ended while the app was closed become "done" (still un-alerted) right away.
  let timers: readonly KitchenTimer[] = settleTimers(read(), now()).timers;

  const commit = (next: readonly KitchenTimer[]) => {
    if (next === timers) return;
    timers = next;
    write(next);
    listeners.forEach((l) => l());
  };

  return {
    getSnapshot: () => timers,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    start(input) {
      const result = startTimer(settleTimers(timers, now()).timers, input, now(), newId());
      commit(result.timers);
      return { timer: result.timer, action: result.action };
    },
    pause: (id) => commit(pauseTimer(timers, id, now())),
    resume: (id) => commit(resumeTimer(timers, id, now())),
    addTime: (id, ms) => commit(addTime(timers, id, ms, now())),
    restart: (id) => commit(restartTimer(timers, id, now())),
    dismiss: (id) => commit(dismissTimer(timers, id)),
    dismissAllDone: () => commit(dismissAllDone(timers)),
    tick() {
      const { timers: next, finished } = settleTimers(timers, now());
      commit(next);
      return finished;
    },
    markAlerted: (ids) => commit(markAlerted(timers, ids)),
    reload() {
      const next = settleTimers(read(), now()).timers;
      if (JSON.stringify(next) !== JSON.stringify(timers)) commit(next);
    },
  };
}

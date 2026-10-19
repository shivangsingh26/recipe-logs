import { describe, expect, it } from "vitest";
import { finishedAgo, spokenDuration, spokenLength } from "./labels";
import {
  addTime,
  createTimerStore,
  dismissAllDone,
  MAX_TIMERS,
  pauseTimer,
  remainingMs,
  sanitizeTimers,
  settleTimers,
  startTimer,
  timerKey,
  type KitchenTimer,
  type StorageLike,
} from "./store";

const MIN = 60_000;
const input = { label: "Step 1 · Biryani", detail: "14 min", durationMs: 14 * MIN, recipeId: "r1", stepId: "s1" };

function memoryStorage(initial: Record<string, string> = {}): StorageLike & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: (k) => data[k] ?? null,
    setItem: (k, v) => {
      data[k] = v;
    },
    removeItem: (k) => {
      delete data[k];
    },
  };
}

function clockStore(start = 1_000_000, storage = memoryStorage()) {
  let now = start;
  let n = 0;
  const store = createTimerStore({ now: () => now, newId: () => `t${++n}`, storage, storageKey: "k" });
  return { store, storage, advance: (ms: number) => (now += ms), at: () => now };
}

describe("timer transitions", () => {
  it("starts a running timer keyed by recipe, step and seconds", () => {
    const { timers, timer, action } = startTimer([], input, 0, "a");
    expect(action).toBe("started");
    expect(timer).toMatchObject({ key: timerKey("r1", "s1", 840), status: "running", endsAt: 14 * MIN, durationMs: 14 * MIN });
    expect(timers).toHaveLength(1);
    expect(remainingMs(timer, 4 * MIN)).toBe(10 * MIN);
  });

  it("toggles instead of duplicating when the same chip is tapped again", () => {
    let list = startTimer([], input, 0, "a").timers;
    const paused = startTimer(list, input, 2 * MIN, "b");
    expect(paused.action).toBe("paused");
    expect(paused.timers).toHaveLength(1);
    expect(paused.timer).toMatchObject({ status: "paused", remainingMs: 12 * MIN, endsAt: null });
    list = paused.timers;
    const resumed = startTimer(list, input, 10 * MIN, "c");
    expect(resumed.action).toBe("resumed");
    expect(resumed.timer.endsAt).toBe(22 * MIN);
  });

  it("restarts a finished timer from the chip", () => {
    const list = settleTimers(startTimer([], input, 0, "a").timers, 15 * MIN).timers;
    const again = startTimer(list, input, 20 * MIN, "b");
    expect(again.action).toBe("restarted");
    expect(again.timer).toMatchObject({ status: "running", endsAt: 34 * MIN, alerted: false });
  });

  it("adds time to running, paused and finished timers", () => {
    let list = startTimer([], input, 0, "a").timers;
    list = addTime(list, "a", MIN, 0);
    expect(list[0].endsAt).toBe(15 * MIN);
    list = pauseTimer(list, "a", 5 * MIN);
    list = addTime(list, "a", MIN, 5 * MIN);
    expect(list[0].remainingMs).toBe(11 * MIN);
    const done = settleTimers(startTimer([], input, 0, "b").timers, 20 * MIN).timers;
    const snoozed = addTime(done, "b", MIN, 20 * MIN);
    expect(snoozed[0]).toMatchObject({ status: "running", endsAt: 21 * MIN });
  });

  it("settles finished timers once and keeps references when nothing changes", () => {
    const list = startTimer([], input, 0, "a").timers;
    expect(settleTimers(list, MIN).timers).toBe(list);
    const settled = settleTimers(list, 14 * MIN);
    expect(settled.finished.map((t) => t.id)).toEqual(["a"]);
    expect(settled.timers[0]).toMatchObject({ status: "done", doneAt: 14 * MIN, alerted: false });
    expect(settleTimers(settled.timers, 20 * MIN).finished).toEqual([]);
    expect(dismissAllDone(settled.timers)).toEqual([]);
  });

  it("caps the list, dropping finished timers first", () => {
    let list: KitchenTimer[] = [];
    for (let i = 0; i < MAX_TIMERS + 3; i++) {
      list = startTimer(list, { ...input, stepId: `s${i}` }, i, `t${i}`).timers;
    }
    expect(list).toHaveLength(MAX_TIMERS);
  });

  it("sanitizes stored data", () => {
    const now = 100 * MIN;
    const good = startTimer([], input, now, "a").timers[0];
    const list = sanitizeTimers(
      [good, { ...good }, { id: "x" }, "junk", { ...good, id: "old", status: "done", doneAt: now - 13 * 60 * MIN }],
      now,
    );
    expect(list.map((t) => t.id)).toEqual(["a"]);
    expect(sanitizeTimers("nope", now)).toEqual([]);
  });
});

describe("createTimerStore", () => {
  it("persists to storage and notifies subscribers", () => {
    const { store, storage, advance } = clockStore();
    let calls = 0;
    store.subscribe(() => calls++);
    const { timer } = store.start(input);
    expect(JSON.parse(storage.data.k)).toHaveLength(1);
    const snapshot = store.getSnapshot();
    expect(store.getSnapshot()).toBe(snapshot);
    advance(MIN);
    store.pause(timer.id);
    expect(store.getSnapshot()[0].status).toBe("paused");
    store.dismiss(timer.id);
    expect(storage.data.k).toBeUndefined();
    expect(calls).toBe(3);
  });

  it("finishes timers whose time passed while the app was closed, and alerts once", () => {
    const first = clockStore();
    first.store.start(input);
    const reopened = clockStore(first.at() + 17 * MIN, first.storage);
    const [timer] = reopened.store.getSnapshot();
    expect(timer).toMatchObject({ status: "done", alerted: false });
    expect(finishedAgo(reopened.at() - (timer.doneAt ?? 0))).toBe("3 min ago");
    reopened.store.markAlerted([timer.id]);
    expect(reopened.store.getSnapshot()[0].alerted).toBe(true);
  });

  it("reports timers finishing on tick", () => {
    const { store, advance } = clockStore();
    store.start(input);
    advance(13 * MIN);
    expect(store.tick()).toEqual([]);
    advance(MIN);
    expect(store.tick().map((t) => t.label)).toEqual(["Step 1 · Biryani"]);
    expect(store.tick()).toEqual([]);
  });

  it("survives broken storage", () => {
    const broken: StorageLike = {
      getItem: () => "{not json",
      setItem: () => {
        throw new Error("quota");
      },
      removeItem: () => undefined,
    };
    const store = createTimerStore({ now: () => 0, newId: () => "a", storage: broken });
    expect(store.getSnapshot()).toEqual([]);
    expect(() => store.start(input)).not.toThrow();
    expect(store.getSnapshot()).toHaveLength(1);
  });
});

describe("timer labels", () => {
  it("speaks durations", () => {
    expect(spokenDuration(761)).toBe("12 minutes 41 seconds");
    expect(spokenDuration(3600)).toBe("1 hour");
    expect(spokenDuration(0)).toBe("0 seconds");
    expect(spokenLength(840)).toBe("14 minute");
    expect(spokenLength(5400)).toBe("1 hour 30 minute");
    expect(finishedAgo(10_000)).toBe("just now");
    expect(finishedAgo(2 * 60 * MIN)).toBe("2 h ago");
  });
});

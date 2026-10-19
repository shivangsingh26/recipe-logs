import { beforeEach, describe, expect, it } from "vitest";
import { createRedisStore } from "../lib/redisStore.js";
import { createMemoryStore, type InboxItem, type Store } from "../lib/store.js";
import { createFakeRedis } from "./fakeRedis.js";

const DAY = 24 * 60 * 60;
const OPTS = { ttlSeconds: 7 * DAY, maxPending: 3 };

function item(id: string, receivedAt: number, text = `recipe ${id}`): InboxItem {
  return { id, text, title: `Dish ${id}`, source: "shortcut", receivedAt };
}

const factories: Array<[string, (now: () => number) => Store]> = [
  ["memory", (now) => createMemoryStore(now)],
  ["redis", (now) => createRedisStore(createFakeRedis(now), now)],
];

describe.each(factories)("%s store", (_name, makeStore) => {
  let clock: number;
  let store: Store;
  const now = () => clock;

  beforeEach(() => {
    clock = Date.UTC(2026, 9, 19, 12);
    store = makeStore(now);
  });

  describe("registration", () => {
    it("registers an inbox under the pairing fingerprint", async () => {
      expect(await store.getRegistration("inbox-a")).toBeNull();
      expect(await store.register("inbox-a", "fp1", 5)).toBe("registered");
      expect(await store.getRegistration("inbox-a")).toBe("fp1");
      expect(await store.register("inbox-a", "fp1", 5)).toBe("exists");
    });

    it("refuses more inboxes than allowed", async () => {
      await store.register("inbox-a", "fp1", 2);
      await store.register("inbox-b", "fp1", 2);
      expect(await store.register("inbox-c", "fp1", 2)).toBe("full");
    });

    it("drops registrations from an older pairing code when registering", async () => {
      await store.register("inbox-a", "old", 1);
      expect(await store.register("inbox-b", "new", 1)).toBe("registered");
      expect(await store.getRegistration("inbox-a")).toBeNull();
    });

    it("unregistering deletes the inbox and its recipes", async () => {
      await store.register("inbox-a", "fp1", 5);
      await store.push("inbox-a", item("1", clock), { ...OPTS, dedupeKey: "h1" });
      await store.unregister("inbox-a");
      expect(await store.getRegistration("inbox-a")).toBeNull();
      expect(await store.list("inbox-a", 50)).toEqual([]);
    });
  });

  describe("inbox", () => {
    it("lists pushed recipes oldest first", async () => {
      await store.push("inbox-a", item("2", clock + 1), { ...OPTS, dedupeKey: "h2" });
      await store.push("inbox-a", item("1", clock), { ...OPTS, dedupeKey: "h1" });
      expect((await store.list("inbox-a", 50)).map((i) => i.id)).toEqual(["1", "2"]);
    });

    it("keeps inboxes apart", async () => {
      await store.push("inbox-a", item("1", clock), { ...OPTS, dedupeKey: "h1" });
      expect(await store.list("inbox-b", 50)).toEqual([]);
    });

    it("reports a duplicate instead of storing the same text twice", async () => {
      expect(await store.push("inbox-a", item("1", clock), { ...OPTS, dedupeKey: "same" })).toEqual({
        status: "created",
        item: item("1", clock),
      });
      expect(await store.push("inbox-a", item("2", clock), { ...OPTS, dedupeKey: "same" })).toEqual({
        status: "duplicate",
        id: "1",
      });
      expect(await store.list("inbox-a", 50)).toHaveLength(1);
    });

    it("still treats a resend as a duplicate after the app collected it", async () => {
      await store.push("inbox-a", item("1", clock), { ...OPTS, dedupeKey: "same" });
      await store.ack("inbox-a", ["1"]);
      expect(await store.push("inbox-a", item("2", clock), { ...OPTS, dedupeKey: "same" })).toMatchObject({
        status: "duplicate",
      });
    });

    it("refuses new recipes when the inbox is full", async () => {
      for (const id of ["1", "2", "3"]) {
        await store.push("inbox-a", item(id, clock), { ...OPTS, dedupeKey: `h${id}` });
      }
      expect(await store.push("inbox-a", item("4", clock), { ...OPTS, dedupeKey: "h4" })).toEqual({ status: "full" });
      // A refused recipe can be sent again once there is room.
      await store.ack("inbox-a", ["1"]);
      expect(await store.push("inbox-a", item("4", clock), { ...OPTS, dedupeKey: "h4" })).toMatchObject({
        status: "created",
      });
    });

    it("forgets recipes after their time to live", async () => {
      await store.push("inbox-a", item("1", clock), { ...OPTS, dedupeKey: "h1" });
      clock += 7 * DAY * 1000 + 1;
      expect(await store.list("inbox-a", 50)).toEqual([]);
      for (const id of ["2", "3", "4"]) {
        await store.push("inbox-a", item(id, clock), { ...OPTS, dedupeKey: `h${id}` });
      }
      expect((await store.list("inbox-a", 50)).map((i) => i.id)).toEqual(["2", "3", "4"]);
    });

    it("limits how many recipes one listing returns", async () => {
      for (const id of ["1", "2", "3"]) {
        await store.push("inbox-a", item(id, clock + Number(id)), { ...OPTS, dedupeKey: `h${id}` });
      }
      expect((await store.list("inbox-a", 2)).map((i) => i.id)).toEqual(["1", "2"]);
    });

    it("acknowledging deletes only the named recipes", async () => {
      await store.push("inbox-a", item("1", clock), { ...OPTS, dedupeKey: "h1" });
      await store.push("inbox-a", item("2", clock + 1), { ...OPTS, dedupeKey: "h2" });
      expect(await store.ack("inbox-a", ["1", "missing"])).toBe(1);
      expect((await store.list("inbox-a", 50)).map((i) => i.id)).toEqual(["2"]);
    });
  });

  describe("rate counter", () => {
    it("counts hits per window and starts over after it", async () => {
      expect(await store.hit("k", 60)).toBe(1);
      expect(await store.hit("k", 60)).toBe(2);
      clock += 60_001;
      expect(await store.hit("k", 60)).toBe(1);
    });
  });
});

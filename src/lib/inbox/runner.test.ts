import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { InboxError, type InboxClient, type InboxItem } from "./client";
import type { RelayConnection } from "./connection";
import { createInboxRunner, type RunnerDeps } from "./runner";
import type { InboxOutcome } from "./sync";

const CONNECTION: RelayConnection = {
  relayUrl: "https://relay.example.app",
  token: "t".repeat(43),
  pairingCode: "pairing-code-0123456789",
  pairedAt: 1,
  lastSyncAt: null,
  lastError: null,
};

const RECIPE = "# Dal\n\n## Ingredients\n\n- 1 cup dal\n- 3 cups water\n\n## Method\n\n1. Boil for 20 min.";

function setup(options: { items?: InboxItem[]; listError?: InboxError; connected?: boolean; online?: boolean } = {}) {
  let connection: RelayConnection | null = options.connected === false ? null : { ...CONNECTION };
  let clock = 1_000_000;
  let lists = 0;
  const processed = new Set<string>();
  const client: InboxClient = {
    list: async () => {
      lists++;
      await new Promise((resolve) => setTimeout(resolve, 5));
      if (options.listError) throw options.listError;
      return options.items ?? [];
    },
    ack: async () => {},
    pair: async () => {},
    unpair: async () => {},
  };
  const deps: RunnerDeps = {
    getConnection: () => connection,
    updateConnection: (patch) => {
      if (connection) connection = { ...connection, ...patch };
    },
    makeClient: () => client,
    processed: () => ({ has: (id) => processed.has(id), add: (id) => void processed.add(id) }),
    now: () => clock,
    isOnline: () => options.online !== false,
    withLock: (fn) => fn(),
  };
  return {
    runner: createInboxRunner(deps),
    lists: () => lists,
    connection: () => connection,
    advance: (ms: number) => {
      clock += ms;
    },
  };
}

beforeEach(async () => {
  await db.recipes.clear();
});

describe("inbox runner", () => {
  it("skips when not connected or offline", async () => {
    expect(await setup({ connected: false }).runner.run()).toEqual({ status: "skipped" });
    const offline = setup({ online: false });
    expect(await offline.runner.run()).toEqual({ status: "skipped" });
    expect(offline.lists()).toBe(0);
  });

  it("imports recipes, records the sync and tells listeners", async () => {
    const t = setup({ items: [{ id: "1", text: RECIPE, title: "Dal", source: "shortcut", receivedAt: 1 }] });
    const heard: InboxOutcome[][] = [];
    t.runner.onOutcomes((outcomes) => heard.push(outcomes));
    const result = await t.runner.run();
    expect(result.status).toBe("synced");
    expect(heard).toHaveLength(1);
    expect(heard[0][0]).toMatchObject({ kind: "created" });
    expect(t.connection()).toMatchObject({ lastSyncAt: 1_000_000, lastError: null });
  });

  it("does not bother listeners when nothing arrived", async () => {
    const t = setup();
    let calls = 0;
    t.runner.onOutcomes(() => calls++);
    await t.runner.run();
    expect(calls).toBe(0);
  });

  it("shares one request between overlapping runs", async () => {
    const t = setup();
    await Promise.all([t.runner.run(), t.runner.run({ force: true })]);
    expect(t.lists()).toBe(1);
  });

  it("waits a little between automatic runs, unless forced", async () => {
    const t = setup();
    await t.runner.run();
    expect(await t.runner.run()).toEqual({ status: "skipped" });
    await t.runner.run({ force: true });
    t.advance(15_001);
    await t.runner.run();
    expect(t.lists()).toBe(3);
  });

  it("records why a sync failed", async () => {
    const t = setup({ listError: new InboxError("unauthorized") });
    expect(await t.runner.run()).toEqual({ status: "failed", error: "unauthorized" });
    expect(t.connection()).toMatchObject({ lastError: "unauthorized", lastSyncAt: null });
  });
});

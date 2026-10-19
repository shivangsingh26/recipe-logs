// When and how often the app collects recipes from the relay. One run at a time (shared by
// overlapping callers and, via Web Locks, by other tabs), at most every 15 s unless forced
// ("Check now"). Results go to listeners (InboxSync shows the toasts).

import { createInboxClient, InboxError, type InboxClient, type InboxErrorKind } from "./client";
import { getConnection, updateConnection, type RelayConnection } from "./connection";
import { createProcessedIds, syncInbox, type InboxOutcome, type ProcessedIds } from "./sync";

const MIN_INTERVAL_MS = 15_000;
const LOCK_NAME = "culinarylog-inbox-sync";

export type SyncRunResult =
  | { status: "synced"; outcomes: InboxOutcome[] }
  /** Not connected, offline, ran moments ago, or another tab is syncing. */
  | { status: "skipped" }
  | { status: "failed"; error: InboxErrorKind };

export interface RunnerDeps {
  getConnection(): RelayConnection | null;
  updateConnection(patch: Partial<RelayConnection>): void;
  makeClient(connection: RelayConnection): InboxClient;
  processed(): ProcessedIds;
  now(): number;
  isOnline(): boolean;
  /** Runs `fn` while holding the cross-tab lock; resolves null if another tab holds it. */
  withLock<T>(fn: () => Promise<T>): Promise<T | null>;
}

export interface InboxRunner {
  run(options?: { force?: boolean }): Promise<SyncRunResult>;
  onOutcomes(listener: (outcomes: InboxOutcome[]) => void): () => void;
}

export function createInboxRunner(deps: RunnerDeps): InboxRunner {
  const listeners = new Set<(outcomes: InboxOutcome[]) => void>();
  let inFlight: Promise<SyncRunResult> | null = null;
  let lastRunAt = -Infinity;

  async function attempt(connection: RelayConnection): Promise<SyncRunResult> {
    try {
      const outcomes = await deps.withLock(() => syncInbox(deps.makeClient(connection), deps.processed()));
      if (outcomes === null) return { status: "skipped" };
      deps.updateConnection({ lastSyncAt: deps.now(), lastError: null });
      if (outcomes.length > 0) listeners.forEach((listener) => listener(outcomes));
      return { status: "synced", outcomes };
    } catch (error) {
      // Anything that isn't the relay talking (e.g. a local database error) is reported as "server".
      const kind = error instanceof InboxError ? error.kind : "server";
      deps.updateConnection({ lastError: kind });
      return { status: "failed", error: kind };
    }
  }

  return {
    run({ force = false } = {}) {
      if (inFlight) return inFlight;
      const connection = deps.getConnection();
      if (!connection || !deps.isOnline()) return Promise.resolve({ status: "skipped" });
      if (!force && deps.now() - lastRunAt < MIN_INTERVAL_MS) return Promise.resolve({ status: "skipped" });
      lastRunAt = deps.now();
      inFlight = attempt(connection).finally(() => {
        inFlight = null;
      });
      return inFlight;
    },
    onOutcomes(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

function withBrowserLock<T>(fn: () => Promise<T>): Promise<T | null> {
  const locks = typeof navigator !== "undefined" ? navigator.locks : undefined;
  if (!locks?.request) return fn();
  return new Promise<T | null>((resolve, reject) => {
    locks
      .request(LOCK_NAME, { ifAvailable: true }, async (lock) => {
        if (!lock) return resolve(null);
        try {
          resolve(await fn());
        } catch (error) {
          reject(error);
        }
      })
      .catch(reject);
  });
}

/** The app-wide runner, wired to the browser. */
export const inboxRunner = createInboxRunner({
  getConnection,
  updateConnection,
  makeClient: (connection) => createInboxClient(connection.relayUrl, connection.token),
  processed: () => createProcessedIds(window.localStorage),
  now: () => Date.now(),
  isOnline: () => typeof navigator === "undefined" || navigator.onLine !== false,
  withLock: withBrowserLock,
});

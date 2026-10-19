// Storage behind the relay. Store-and-forget: a recipe waits here until the app acknowledges it
// (then it is deleted) or its time to live runs out. MemoryStore serves local dev and tests;
// RedisStore (./redisStore.ts) is the deployed one.

export interface InboxItem {
  id: string;
  /** The recipe text exactly as received (after the relay's light clean-up). */
  text: string;
  /** Short name for messages; the app takes the real title from the parsed text. */
  title: string;
  /** Who sent it: "shortcut" today, "mcp" later. */
  source: string;
  receivedAt: number;
}

export interface PushOptions {
  /** Hash of the text; the same text arriving again within the TTL is a duplicate. */
  dedupeKey: string;
  ttlSeconds: number;
  maxPending: number;
}

export type PushResult = { status: "created"; item: InboxItem } | { status: "duplicate"; id: string } | { status: "full" };

export type RegisterResult = "registered" | "exists" | "full";

export interface Store {
  /** The pairing-code fingerprint the inbox was registered under, or null. */
  getRegistration(inboxId: string): Promise<string | null>;
  /** Registers an inbox; registrations made under any other fingerprint are dropped. */
  register(inboxId: string, fingerprint: string, maxInboxes: number): Promise<RegisterResult>;
  /** Removes the registration and every recipe waiting in the inbox. */
  unregister(inboxId: string): Promise<void>;
  push(inboxId: string, item: InboxItem, options: PushOptions): Promise<PushResult>;
  /** Waiting recipes, oldest first. */
  list(inboxId: string, limit: number): Promise<InboxItem[]>;
  /** Deletes the named recipes; returns how many existed. */
  ack(inboxId: string, ids: string[]): Promise<number>;
  /** Counts a hit in the current fixed window of `windowSeconds`; returns the count so far. */
  hit(key: string, windowSeconds: number): Promise<number>;
}

/** Window-numbered counter key, so a counter can never outlive its window. */
export function windowKey(key: string, windowSeconds: number, now: number): string {
  return `${key}:${Math.floor(now / (windowSeconds * 1000))}`;
}

export function byReceivedAt(a: InboxItem, b: InboxItem): number {
  return a.receivedAt - b.receivedAt || a.id.localeCompare(b.id);
}

export function createMemoryStore(now: () => number = Date.now): Store {
  const registrations = new Map<string, string>();
  const inboxes = new Map<string, Map<string, { item: InboxItem; expiresAt: number }>>();
  const dedupe = new Map<string, { id: string; expiresAt: number }>();
  const counters = new Map<string, { count: number; expiresAt: number }>();

  const liveItems = (inboxId: string) => {
    const items = inboxes.get(inboxId) ?? new Map();
    for (const [id, entry] of items) if (entry.expiresAt <= now()) items.delete(id);
    return items;
  };

  return {
    async getRegistration(inboxId) {
      return registrations.get(inboxId) ?? null;
    },
    async register(inboxId, fingerprint, maxInboxes) {
      for (const [id, fp] of registrations) if (fp !== fingerprint) registrations.delete(id);
      if (registrations.has(inboxId)) return "exists";
      if (registrations.size >= maxInboxes) return "full";
      registrations.set(inboxId, fingerprint);
      return "registered";
    },
    async unregister(inboxId) {
      registrations.delete(inboxId);
      inboxes.delete(inboxId);
    },
    async push(inboxId, item, { dedupeKey, ttlSeconds, maxPending }) {
      const key = `${inboxId}:${dedupeKey}`;
      const seen = dedupe.get(key);
      if (seen && seen.expiresAt > now()) return { status: "duplicate", id: seen.id };
      const items = liveItems(inboxId);
      if (items.size >= maxPending) return { status: "full" };
      const expiresAt = item.receivedAt + ttlSeconds * 1000;
      items.set(item.id, { item: { ...item }, expiresAt });
      inboxes.set(inboxId, items);
      dedupe.set(key, { id: item.id, expiresAt });
      return { status: "created", item: { ...item } };
    },
    async list(inboxId, limit) {
      return [...liveItems(inboxId).values()]
        .map((entry) => ({ ...entry.item }))
        .sort(byReceivedAt)
        .slice(0, limit);
    },
    async ack(inboxId, ids) {
      const items = liveItems(inboxId);
      let removed = 0;
      for (const id of ids) if (items.delete(id)) removed++;
      return removed;
    },
    async hit(key, windowSeconds) {
      const k = windowKey(key, windowSeconds, now());
      const entry = counters.get(k);
      const count = entry && entry.expiresAt > now() ? entry.count + 1 : 1;
      counters.set(k, { count, expiresAt: now() + windowSeconds * 1000 });
      return count;
    },
  };
}

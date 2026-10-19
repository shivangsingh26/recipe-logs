// The deployed store: Upstash Redis (via the Vercel Marketplace). Each recipe is its own key
// with a Redis TTL, so an uncollected recipe disappears on time even if nothing else happens.
//
// Keys
//   relay:inboxes                 hash   inboxId → { fp, at }       registrations
//   relay:idx:<inbox>             zset   itemId, score = expiry     waiting recipes, in order
//   relay:item:<inbox>:<itemId>   value  InboxItem (EX ttl)
//   relay:dedupe:<inbox>:<hash>   value  { id } (EX ttl)           resend detection
//   relay:rl:<key>:<window>       count  (EX window)               rate limits

import { byReceivedAt, windowKey, type InboxItem, type Store } from "./store.js";

/** The subset of the @upstash/redis client used here (values are JSON-serialised by the client). */
export interface RedisLike {
  hget(key: string, field: string): Promise<unknown>;
  hset(key: string, values: Record<string, unknown>): Promise<number>;
  hdel(key: string, ...fields: string[]): Promise<number>;
  hgetall(key: string): Promise<Record<string, unknown> | null>;
  set(key: string, value: unknown, options?: { nx?: true; ex?: number }): Promise<unknown>;
  get(key: string): Promise<unknown>;
  mget(...keys: string[]): Promise<unknown[]>;
  del(...keys: string[]): Promise<number>;
  zadd(key: string, member: { score: number; member: string }): Promise<unknown>;
  zrange(key: string, start: number, stop: number): Promise<unknown[]>;
  zrem(key: string, ...members: string[]): Promise<number>;
  zremrangebyscore(key: string, min: number, max: number): Promise<number>;
  zcard(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<number>;
  incr(key: string): Promise<number>;
}

const INBOXES = "relay:inboxes";
const idxKey = (inbox: string) => `relay:idx:${inbox}`;
const itemKey = (inbox: string, id: string) => `relay:item:${inbox}:${id}`;
const dedupeKeyFor = (inbox: string, hash: string) => `relay:dedupe:${inbox}:${hash}`;

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function fingerprintOf(value: unknown): string | null {
  const fp = record(value)?.fp;
  return typeof fp === "string" ? fp : null;
}

function asItem(value: unknown): InboxItem | null {
  const r = record(value);
  if (!r) return null;
  const { id, text, title, source, receivedAt } = r;
  if (typeof id !== "string" || typeof text !== "string" || typeof receivedAt !== "number") return null;
  return {
    id,
    text,
    title: typeof title === "string" ? title : "",
    source: typeof source === "string" ? source : "shortcut",
    receivedAt,
  };
}

export function createRedisStore(redis: RedisLike, now: () => number = Date.now): Store {
  const pruneExpired = (inbox: string) => redis.zremrangebyscore(idxKey(inbox), 0, now());

  return {
    async getRegistration(inboxId) {
      return fingerprintOf(await redis.hget(INBOXES, inboxId));
    },

    async register(inboxId, fingerprint, maxInboxes) {
      const all = (await redis.hgetall(INBOXES)) ?? {};
      const stale = Object.keys(all).filter((id) => fingerprintOf(all[id]) !== fingerprint);
      if (stale.length > 0) await redis.hdel(INBOXES, ...stale);
      if (fingerprintOf(all[inboxId]) === fingerprint) return "exists";
      if (Object.keys(all).length - stale.length >= maxInboxes) return "full";
      await redis.hset(INBOXES, { [inboxId]: { fp: fingerprint, at: now() } });
      return "registered";
    },

    async unregister(inboxId) {
      await redis.hdel(INBOXES, inboxId);
      const ids = (await redis.zrange(idxKey(inboxId), 0, -1)).map(String);
      if (ids.length > 0) await redis.del(...ids.map((id) => itemKey(inboxId, id)));
      await redis.del(idxKey(inboxId));
    },

    async push(inboxId, item, { dedupeKey, ttlSeconds, maxPending }) {
      const dedupe = dedupeKeyFor(inboxId, dedupeKey);
      const seen = record(await redis.get(dedupe));
      if (seen && typeof seen.id === "string") return { status: "duplicate", id: seen.id };

      await pruneExpired(inboxId);
      if ((await redis.zcard(idxKey(inboxId))) >= maxPending) return { status: "full" };

      // NX: if the same text raced in meanwhile, the first one wins.
      if ((await redis.set(dedupe, { id: item.id }, { nx: true, ex: ttlSeconds })) === null) {
        const winner = record(await redis.get(dedupe));
        return { status: "duplicate", id: typeof winner?.id === "string" ? winner.id : item.id };
      }
      await redis.set(itemKey(inboxId, item.id), item, { ex: ttlSeconds });
      await redis.zadd(idxKey(inboxId), { score: item.receivedAt + ttlSeconds * 1000, member: item.id });
      await redis.expire(idxKey(inboxId), ttlSeconds);
      return { status: "created", item: { ...item } };
    },

    async list(inboxId, limit) {
      await pruneExpired(inboxId);
      const ids = (await redis.zrange(idxKey(inboxId), 0, limit - 1)).map(String);
      if (ids.length === 0) return [];
      const values = await redis.mget(...ids.map((id) => itemKey(inboxId, id)));
      const items = values.map(asItem);
      const missing = ids.filter((_, i) => items[i] === null);
      if (missing.length > 0) await redis.zrem(idxKey(inboxId), ...missing);
      return items.filter((i): i is InboxItem => i !== null).sort(byReceivedAt);
    },

    async ack(inboxId, ids) {
      if (ids.length === 0) return 0;
      const removed = await redis.del(...ids.map((id) => itemKey(inboxId, id)));
      await redis.zrem(idxKey(inboxId), ...ids);
      return removed;
    },

    async hit(key, windowSeconds) {
      const k = `relay:rl:${windowKey(key, windowSeconds, now())}`;
      const count = await redis.incr(k);
      await redis.expire(k, windowSeconds);
      return count;
    },
  };
}

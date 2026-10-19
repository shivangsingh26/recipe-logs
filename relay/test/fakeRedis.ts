// In-memory stand-in for the subset of the Upstash Redis client that RedisStore uses, so the
// store contract tests can run without a network. Values round-trip through JSON like Upstash's
// automatic (de)serialisation.

import type { RedisLike } from "../lib/redisStore.js";

type Entry = { value: unknown; expiresAt: number | null };

export function createFakeRedis(now: () => number): RedisLike {
  const data = new Map<string, Entry>();

  const live = (key: string): Entry | undefined => {
    const entry = data.get(key);
    if (entry && entry.expiresAt !== null && entry.expiresAt <= now()) {
      data.delete(key);
      return undefined;
    }
    return entry;
  };
  const copy = <T>(value: T): T => (value === undefined ? value : JSON.parse(JSON.stringify(value)));
  const hash = (key: string) => (live(key)?.value as Record<string, unknown> | undefined) ?? undefined;
  const zset = (key: string) => (live(key)?.value as Map<string, number> | undefined) ?? undefined;
  const ensure = <T>(key: string, make: () => T): T => {
    const entry = live(key);
    if (entry) return entry.value as T;
    const value = make();
    data.set(key, { value, expiresAt: null });
    return value;
  };
  const sortedMembers = (key: string) =>
    [...(zset(key) ?? new Map<string, number>()).entries()].sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]));

  return {
    async hget(key, field) {
      const value = hash(key)?.[field];
      return value === undefined ? null : copy(value);
    },
    async hset(key, values) {
      const target = ensure<Record<string, unknown>>(key, () => ({}));
      let added = 0;
      for (const [field, value] of Object.entries(values)) {
        if (!(field in target)) added++;
        target[field] = copy(value);
      }
      return added;
    },
    async hdel(key, ...fields) {
      const target = hash(key);
      if (!target) return 0;
      let removed = 0;
      for (const field of fields) if (field in target && delete target[field]) removed++;
      if (Object.keys(target).length === 0) data.delete(key);
      return removed;
    },
    async hgetall(key) {
      const target = hash(key);
      return target && Object.keys(target).length > 0 ? copy(target) : null;
    },
    async set(key, value, options) {
      if (options?.nx && live(key)) return null;
      data.set(key, { value: copy(value), expiresAt: options?.ex ? now() + options.ex * 1000 : null });
      return "OK";
    },
    async get(key) {
      const entry = live(key);
      return entry ? copy(entry.value) : null;
    },
    async mget(...keys) {
      return keys.map((key) => {
        const entry = live(key);
        return entry ? copy(entry.value) : null;
      });
    },
    async del(...keys) {
      let removed = 0;
      for (const key of keys) if (live(key) && data.delete(key)) removed++;
      return removed;
    },
    async zadd(key, { score, member }) {
      const target = ensure(key, () => new Map<string, number>());
      const added = target.has(member) ? 0 : 1;
      target.set(member, score);
      return added;
    },
    async zrange(key, start, stop) {
      const members = sortedMembers(key).map(([member]) => member);
      return members.slice(start, stop < 0 ? members.length + stop + 1 : stop + 1);
    },
    async zrem(key, ...members) {
      const target = zset(key);
      if (!target) return 0;
      let removed = 0;
      for (const member of members) if (target.delete(member)) removed++;
      if (target.size === 0) data.delete(key);
      return removed;
    },
    async zremrangebyscore(key, min, max) {
      const target = zset(key);
      if (!target) return 0;
      let removed = 0;
      for (const [member, score] of target) {
        if (score >= min && score <= max && target.delete(member)) removed++;
      }
      if (target.size === 0) data.delete(key);
      return removed;
    },
    async zcard(key) {
      return zset(key)?.size ?? 0;
    },
    async expire(key, seconds) {
      const entry = live(key);
      if (!entry) return 0;
      entry.expiresAt = now() + seconds * 1000;
      return 1;
    },
    async incr(key) {
      const entry = live(key);
      const next = (typeof entry?.value === "number" ? entry.value : 0) + 1;
      data.set(key, { value: next, expiresAt: entry?.expiresAt ?? null });
      return next;
    },
  };
}

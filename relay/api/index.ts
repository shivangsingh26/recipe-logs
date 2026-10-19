// Vercel entry point. vercel.json rewrites every /api/* path here; lib/router.ts routes it.

import { Redis } from "@upstash/redis";
import { ConfigError, configFromEnv, redisCredentials } from "../lib/config.js";
import { createRedisStore, type RedisLike } from "../lib/redisStore.js";
import { handleRequest, type RelayDeps } from "../lib/router.js";

let deps: RelayDeps | null = null;

function load(): RelayDeps {
  const config = configFromEnv(process.env);
  const credentials = redisCredentials(process.env);
  if (!credentials) throw new ConfigError("Redis is not configured (UPSTASH_REDIS_REST_URL / KV_REST_API_URL).");
  return { config, store: createRedisStore(new Redis(credentials) as unknown as RedisLike) };
}

export default {
  async fetch(request: Request): Promise<Response> {
    try {
      deps ??= load();
    } catch (error) {
      const message = error instanceof ConfigError ? error.message : "Relay failed to start.";
      console.error(message);
      return Response.json({ error: "not_configured", message: "The relay is not set up yet." }, { status: 503 });
    }
    return handleRequest(request, deps);
  },
};

// Environment → relay configuration.
//
//   PAIRING_CODE   required, ≥ 16 characters. Needed once to connect the app; change it to
//                  disconnect every device.
//   APP_ORIGINS    comma-separated origins of the app (e.g. https://you.github.io), for CORS.
//   UPSTASH_REDIS_REST_URL / _TOKEN, or KV_REST_API_URL / _TOKEN (Vercel Marketplace names).

import { DEFAULT_CONFIG, type RelayConfig } from "./router.js";

export type Env = Record<string, string | undefined>;

export class ConfigError extends Error {}

const MIN_PAIRING_CODE = 16;

function origins(value: string | undefined): string[] {
  const list: string[] = [];
  for (const raw of (value ?? "").split(",")) {
    try {
      const url = new URL(raw.trim());
      if (url.protocol === "https:" || url.protocol === "http:") list.push(url.origin);
    } catch {
      // Not a URL: ignore it rather than open CORS to something unexpected.
    }
  }
  return list;
}

export function configFromEnv(env: Env): RelayConfig {
  const pairingCode = (env.PAIRING_CODE ?? "").trim();
  if (pairingCode.length < MIN_PAIRING_CODE) {
    throw new ConfigError(`PAIRING_CODE must be set to at least ${MIN_PAIRING_CODE} characters.`);
  }
  return { ...DEFAULT_CONFIG, pairingCode, appOrigins: origins(env.APP_ORIGINS) };
}

export function redisCredentials(env: Env): { url: string; token: string } | null {
  const url = env.UPSTASH_REDIS_REST_URL ?? env.KV_REST_API_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN ?? env.KV_REST_API_TOKEN;
  return url && token ? { url, token } : null;
}

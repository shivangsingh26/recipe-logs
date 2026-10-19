import { describe, expect, it } from "vitest";
import { ConfigError, configFromEnv, redisCredentials } from "../lib/config.js";

const CODE = "pairing-code-0123456789";

describe("configFromEnv", () => {
  it("reads the pairing code and the app origins", () => {
    const config = configFromEnv({
      PAIRING_CODE: CODE,
      APP_ORIGINS: " https://me.github.io , http://localhost:4173/ ,not a url",
    });
    expect(config.pairingCode).toBe(CODE);
    expect(config.appOrigins).toEqual(["https://me.github.io", "http://localhost:4173"]);
    expect(config.ttlSeconds).toBe(7 * 24 * 60 * 60);
  });

  it("refuses to start without a long enough pairing code", () => {
    expect(() => configFromEnv({})).toThrow(ConfigError);
    expect(() => configFromEnv({ PAIRING_CODE: "short" })).toThrow(ConfigError);
  });
});

describe("redisCredentials", () => {
  it("accepts Upstash's and the Vercel Marketplace's variable names", () => {
    expect(redisCredentials({ UPSTASH_REDIS_REST_URL: "https://u", UPSTASH_REDIS_REST_TOKEN: "t" })).toEqual({
      url: "https://u",
      token: "t",
    });
    expect(redisCredentials({ KV_REST_API_URL: "https://k", KV_REST_API_TOKEN: "t2" })).toEqual({
      url: "https://k",
      token: "t2",
    });
  });

  it("returns null when Redis is not configured", () => {
    expect(redisCredentials({})).toBeNull();
    expect(redisCredentials({ KV_REST_API_URL: "https://k" })).toBeNull();
  });
});

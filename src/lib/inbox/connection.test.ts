import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  generateInboxToken,
  getConnection,
  normalizeRelayUrl,
  parseConnectionCode,
  sanitizeConnection,
  setConnection,
  updateConnection,
  type RelayConnection,
} from "./connection";

const CODE = "pairing-code-0123456789";

describe("normalizeRelayUrl", () => {
  it("keeps https origins and paths without a trailing slash", () => {
    expect(normalizeRelayUrl("https://relay.example.app/")).toBe("https://relay.example.app");
    expect(normalizeRelayUrl(" https://host.example/relay/?x=1#y ")).toBe("https://host.example/relay");
  });

  it("allows plain http only for this computer", () => {
    expect(normalizeRelayUrl("http://localhost:8787")).toBe("http://localhost:8787");
    expect(normalizeRelayUrl("http://127.0.0.1:8787/")).toBe("http://127.0.0.1:8787");
    expect(normalizeRelayUrl("http://relay.example.app")).toBeNull();
  });

  it("rejects anything that is not a web URL", () => {
    expect(normalizeRelayUrl("relay.example.app")).toBeNull();
    expect(normalizeRelayUrl("javascript:alert(1)")).toBeNull();
    expect(normalizeRelayUrl("")).toBeNull();
  });
});

describe("parseConnectionCode", () => {
  it("reads the relay URL and the pairing code from the fragment", () => {
    expect(parseConnectionCode(`https://relay.example.app/#pair=${CODE}`)).toEqual({
      relayUrl: "https://relay.example.app",
      pairingCode: CODE,
    });
  });

  it("also accepts the code as a query parameter", () => {
    expect(parseConnectionCode(`https://relay.example.app/?pair=${CODE}`)?.pairingCode).toBe(CODE);
  });

  it("rejects codes without a usable pairing code or relay", () => {
    expect(parseConnectionCode("https://relay.example.app/")).toBeNull();
    expect(parseConnectionCode("https://relay.example.app/#pair=short")).toBeNull();
    expect(parseConnectionCode(`http://relay.example.app/#pair=${CODE}`)).toBeNull();
    expect(parseConnectionCode("not a code")).toBeNull();
  });
});

describe("generateInboxToken", () => {
  it("makes 256-bit url-safe secrets", () => {
    const a = generateInboxToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(generateInboxToken()).not.toBe(a);
  });
});

describe("sanitizeConnection", () => {
  const valid: RelayConnection = {
    relayUrl: "https://relay.example.app",
    token: "t".repeat(43),
    pairingCode: CODE,
    pairedAt: 1,
    lastSyncAt: null,
    lastError: null,
  };

  it("keeps a valid connection", () => {
    expect(sanitizeConnection(valid)).toEqual(valid);
  });

  it("drops a connection with a bad relay URL or secret", () => {
    expect(sanitizeConnection({ ...valid, relayUrl: "http://evil.example" })).toBeNull();
    expect(sanitizeConnection({ ...valid, token: "short" })).toBeNull();
    expect(sanitizeConnection("nope")).toBeNull();
  });

  it("resets unknown status values", () => {
    expect(sanitizeConnection({ ...valid, lastSyncAt: "yesterday", lastError: "weird" })).toEqual(valid);
  });
});

describe("connection storage", () => {
  const values = new Map<string, string>();
  const g = globalThis as { window?: unknown };

  beforeEach(() => {
    values.clear();
    g.window = {
      localStorage: {
        getItem: (k: string) => values.get(k) ?? null,
        setItem: (k: string, v: string) => void values.set(k, v),
        removeItem: (k: string) => void values.delete(k),
      },
      addEventListener: () => {},
      removeEventListener: () => {},
    };
    setConnection(null);
  });

  afterEach(() => {
    delete g.window;
  });

  it("saves, updates and clears the connection", () => {
    expect(getConnection()).toBeNull();
    setConnection({
      relayUrl: "https://relay.example.app",
      token: "t".repeat(43),
      pairingCode: CODE,
      pairedAt: 1,
      lastSyncAt: null,
      lastError: null,
    });
    updateConnection({ lastSyncAt: 5, lastError: "offline" });
    expect(getConnection()).toMatchObject({ lastSyncAt: 5, lastError: "offline" });
    expect(values.size).toBe(1);
    setConnection(null);
    expect(getConnection()).toBeNull();
    expect(values.size).toBe(0);
  });
});

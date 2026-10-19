import { describe, expect, it } from "vitest";
import type { RelayConnection } from "./connection";
import { describeConnection, inboxErrorMessage, relayHost } from "./status";

const NOW = Date.UTC(2026, 9, 20, 12);
const MIN = 60_000;

function connection(patch: Partial<RelayConnection> = {}): RelayConnection {
  return {
    relayUrl: "https://culinarylog-relay.vercel.app",
    token: "t".repeat(43),
    pairingCode: "pairing-code-0123456789",
    pairedAt: NOW - 60 * MIN,
    lastSyncAt: null,
    lastError: null,
    ...patch,
  };
}

describe("describeConnection", () => {
  it("says when the inbox was last checked", () => {
    expect(describeConnection(connection(), NOW)).toEqual({ text: "Not checked yet", tone: "muted" });
    expect(describeConnection(connection({ lastSyncAt: NOW - 20_000 }), NOW).text).toBe("Checked just now");
    expect(describeConnection(connection({ lastSyncAt: NOW - 5 * MIN }), NOW).text).toBe("Checked 5 min ago");
    expect(describeConnection(connection({ lastSyncAt: NOW - 180 * MIN }), NOW).text).toBe("Checked 3 h ago");
    expect(describeConnection(connection({ lastSyncAt: NOW - 2 * 24 * 60 * MIN }), NOW).text).toBe("Checked 2 days ago");
  });

  it("flags a revoked secret", () => {
    expect(describeConnection(connection({ lastError: "unauthorized" }), NOW)).toEqual({
      text: "The relay no longer accepts this device. Disconnect, then connect again.",
      tone: "danger",
    });
  });

  it("mentions a relay it couldn't reach, with the last good check", () => {
    expect(describeConnection(connection({ lastError: "offline", lastSyncAt: NOW - 5 * MIN }), NOW)).toEqual({
      text: "Couldn't reach the relay. Checked 5 min ago",
      tone: "warning",
    });
  });
});

describe("inboxErrorMessage", () => {
  it("explains each failure in plain words", () => {
    expect(inboxErrorMessage("wrong_code")).toBe("That pairing code isn't right.");
    expect(inboxErrorMessage("offline")).toMatch(/Couldn't reach the relay/);
  });
});

describe("relayHost", () => {
  it("shows just the host name", () => {
    expect(relayHost("https://culinarylog-relay.vercel.app")).toBe("culinarylog-relay.vercel.app");
    expect(relayHost("http://localhost:8787")).toBe("localhost:8787");
  });
});

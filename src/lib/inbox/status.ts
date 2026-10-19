// Words for the Gemini connection's state, shown in Settings and in toasts.

import { pluralize } from "@/lib/format";
import type { InboxErrorKind } from "./client";
import type { RelayConnection } from "./connection";

export type StatusTone = "muted" | "warning" | "danger";

const MESSAGES: Record<InboxErrorKind, string> = {
  offline: "Couldn't reach the relay. Check the address and your connection.",
  unauthorized: "The relay no longer accepts this device. Disconnect, then connect again.",
  wrong_code: "That pairing code isn't right.",
  too_many_devices: "This relay already has as many devices connected as it allows.",
  rate_limited: "Too many tries. Wait a little and try again.",
  server: "Something went wrong. Try again.",
  bad_response: "That address didn't answer like a CulinaryLog relay.",
};

export function inboxErrorMessage(kind: InboxErrorKind): string {
  return MESSAGES[kind];
}

function checkedAgo(at: number, now: number): string {
  const minutes = Math.floor((now - at) / 60_000);
  if (minutes < 1) return "Checked just now";
  if (minutes < 60) return `Checked ${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Checked ${hours} h ago`;
  return `Checked ${pluralize(Math.floor(hours / 24), "day")} ago`;
}

export function describeConnection(
  connection: RelayConnection,
  now: number = Date.now(),
): { text: string; tone: StatusTone } {
  if (connection.lastError === "unauthorized") return { text: MESSAGES.unauthorized, tone: "danger" };
  const checked = connection.lastSyncAt === null ? "Not checked yet" : checkedAgo(connection.lastSyncAt, now);
  if (connection.lastError === "offline") return { text: `Couldn't reach the relay. ${checked}`, tone: "warning" };
  if (connection.lastError) return { text: `${MESSAGES[connection.lastError]} ${checked}`, tone: "warning" };
  return { text: checked, tone: "muted" };
}

export function relayHost(relayUrl: string): string {
  try {
    return new URL(relayUrl).host;
  } catch {
    return relayUrl;
  }
}

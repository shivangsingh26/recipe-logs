// The connection to the Gemini relay (see relay/ and docs/automation-options.md): which relay,
// this device's inbox secret, and the last sync status. Device-local like prefs, never in backups.
//
// The connection code the relay prints is its URL with the pairing code in the fragment:
// https://relay.example.app/#pair=<code>.

import { useSyncExternalStore } from "react";
import { STORAGE_KEYS } from "@/lib/storageKeys";
import { INBOX_ERROR_KINDS, type InboxErrorKind } from "./client";

export interface RelayConnection {
  /** Origin (plus path, if any) without a trailing slash. */
  relayUrl: string;
  /** This device's inbox secret; the Shortcut sends it as `Authorization: Bearer …`. */
  token: string;
  /** Kept so "New secret" can pair a fresh inbox without asking for the code again. */
  pairingCode: string;
  pairedAt: number;
  lastSyncAt: number | null;
  lastError: InboxErrorKind | null;
}

const TOKEN_RE = /^[A-Za-z0-9_-]{32,128}$/;
const PAIRING_CODE_RE = /^\S{16,200}$/;
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/** A relay URL the app may talk to: https, or http on this computer (local development). */
export function normalizeRelayUrl(input: string): string | null {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  const allowed = url.protocol === "https:" || (url.protocol === "http:" && LOCAL_HOSTS.has(url.hostname));
  if (!allowed) return null;
  const path = url.pathname.replace(/\/+$/, "");
  return `${url.origin}${path}`;
}

export function parseConnectionCode(input: string): { relayUrl: string; pairingCode: string } | null {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  const pairingCode =
    new URLSearchParams(url.hash.replace(/^#/, "")).get("pair") ?? url.searchParams.get("pair") ?? "";
  const relayUrl = normalizeRelayUrl(input);
  if (!relayUrl || !PAIRING_CODE_RE.test(pairingCode)) return null;
  return { relayUrl, pairingCode };
}

/** 32 random bytes, base64url without padding (43 characters). */
export function generateInboxToken(): string {
  const bytes = new Uint8Array(32);
  globalThis.crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function sanitizeConnection(raw: unknown): RelayConnection | null {
  if (!raw || typeof raw !== "object") return null;
  const c = raw as Partial<Record<keyof RelayConnection, unknown>>;
  const relayUrl = typeof c.relayUrl === "string" ? normalizeRelayUrl(c.relayUrl) : null;
  if (!relayUrl || typeof c.token !== "string" || !TOKEN_RE.test(c.token)) return null;
  const finite = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  return {
    relayUrl,
    token: c.token,
    pairingCode: typeof c.pairingCode === "string" && PAIRING_CODE_RE.test(c.pairingCode) ? c.pairingCode : "",
    pairedAt: finite(c.pairedAt) ?? 0,
    lastSyncAt: finite(c.lastSyncAt),
    lastError: INBOX_ERROR_KINDS.includes(c.lastError as InboxErrorKind) ? (c.lastError as InboxErrorKind) : null,
  };
}

const KEY = STORAGE_KEYS.geminiRelay;
let cache: RelayConnection | null | undefined;
const listeners = new Set<() => void>();

export function getConnection(): RelayConnection | null {
  if (cache !== undefined) return cache;
  if (typeof window === "undefined") return null;
  try {
    cache = sanitizeConnection(JSON.parse(window.localStorage.getItem(KEY) ?? "null"));
  } catch {
    cache = null;
  }
  return cache;
}

export function setConnection(next: RelayConnection | null): void {
  cache = next ? sanitizeConnection(next) : null;
  try {
    if (cache) window.localStorage.setItem(KEY, JSON.stringify(cache));
    else window.localStorage.removeItem(KEY);
  } catch {
    // Storage blocked: the connection lasts for this visit only.
  }
  listeners.forEach((listener) => listener());
}

export function updateConnection(patch: Partial<RelayConnection>): void {
  const current = getConnection();
  if (current) setConnection({ ...current, ...patch });
}

export function subscribeConnection(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === KEY) {
      cache = undefined;
      listener();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** Reactive connection (null while prerendering and when not connected). */
export function useConnection(): RelayConnection | null {
  return useSyncExternalStore(subscribeConnection, getConnection, () => null);
}

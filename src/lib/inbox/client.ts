// HTTP client for the Gemini relay's inbox (relay/lib/router.ts). Everything the relay returns
// is treated as untrusted: items are shape-checked here and parsed/sanitised again on import.

export const INBOX_ERROR_KINDS = [
  "offline",
  "unauthorized",
  "wrong_code",
  "too_many_devices",
  "rate_limited",
  "server",
  "bad_response",
] as const;

export type InboxErrorKind = (typeof INBOX_ERROR_KINDS)[number];

export class InboxError extends Error {
  constructor(readonly kind: InboxErrorKind) {
    super(`Relay request failed: ${kind}`);
    this.name = "InboxError";
  }
}

export interface InboxItem {
  id: string;
  text: string;
  title: string;
  source: string;
  receivedAt: number;
}

export interface InboxClient {
  pair(pairingCode: string): Promise<void>;
  list(): Promise<InboxItem[]>;
  ack(ids: string[]): Promise<void>;
  unpair(): Promise<void>;
}

const MAX_ITEMS = 100;
const MAX_TEXT = 64 * 1024;

export function parseInboxItems(value: unknown): InboxItem[] {
  const items = value && typeof value === "object" ? (value as { items?: unknown }).items : undefined;
  if (!Array.isArray(items)) return [];
  const out: InboxItem[] = [];
  for (const raw of items.slice(0, MAX_ITEMS)) {
    if (!raw || typeof raw !== "object") continue;
    const { id, text, title, source, receivedAt } = raw as Record<string, unknown>;
    if (typeof id !== "string" || !id || id.length > 64) continue;
    if (typeof text !== "string" || !text || text.length > MAX_TEXT) continue;
    if (typeof receivedAt !== "number" || !Number.isFinite(receivedAt)) continue;
    out.push({
      id,
      text,
      title: typeof title === "string" ? title.slice(0, 200) : "",
      source: typeof source === "string" ? source.slice(0, 32) : "shortcut",
      receivedAt,
    });
  }
  return out;
}

function errorFor(status: number): InboxError {
  if (status === 401) return new InboxError("unauthorized");
  if (status === 403) return new InboxError("wrong_code");
  if (status === 409) return new InboxError("too_many_devices");
  if (status === 429) return new InboxError("rate_limited");
  return new InboxError("server");
}

export function createInboxClient(
  relayUrl: string,
  token: string,
  fetchImpl: typeof fetch = (...args) => fetch(...args),
  timeoutMs = 15_000,
): InboxClient {
  async function request(method: string, path: string, body?: unknown): Promise<unknown> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let response: Response;
    try {
      response = await fetchImpl(`${relayUrl}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        cache: "no-store",
        credentials: "omit",
        mode: "cors",
        signal: controller.signal,
      });
    } catch {
      // Network down, DNS failure, CORS refusal or timeout: all look the same from here.
      throw new InboxError("offline");
    } finally {
      clearTimeout(timer);
    }
    if (!response.ok) throw errorFor(response.status);
    try {
      return await response.json();
    } catch {
      throw new InboxError("bad_response");
    }
  }

  return {
    async pair(pairingCode) {
      await request("POST", "/api/pair", { code: pairingCode });
    },
    async list() {
      const body = await request("GET", "/api/inbox");
      if (!body || typeof body !== "object" || !Array.isArray((body as { items?: unknown }).items)) {
        throw new InboxError("bad_response");
      }
      return parseInboxItems(body);
    },
    async ack(ids) {
      if (ids.length === 0) return;
      await request("POST", "/api/inbox/ack", { ids });
    },
    async unpair() {
      await request("DELETE", "/api/pair");
    },
  };
}

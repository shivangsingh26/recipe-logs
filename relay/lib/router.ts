// The relay's HTTP API, as one Web-standard handler (Vercel `fetch` export, local dev server and
// tests all call handleRequest).
//
//   GET    /api/health       liveness, no auth
//   POST   /api/pair         { code }  registers the bearer token's inbox (needs PAIRING_CODE)
//   DELETE /api/pair         unregisters the inbox and deletes what is waiting in it
//   POST   /api/inbox        a recipe from the Shortcut (text, JSON { text } or form text=)
//   GET    /api/inbox        the app collects waiting recipes
//   POST   /api/inbox/ack    { ids }  the app saved these; delete them
//
// The Shortcut gets plain-text replies it can show as a notification (JSON with
// `Accept: application/json`). Everything else speaks JSON.

import { bearerToken, pairingFingerprint, safeEqual, sha256Hex } from "./auth.js";
import { MAX_BODY_BYTES, readRecipeText } from "./payload.js";
import type { InboxItem, Store } from "./store.js";

export interface RelayLimits {
  /** Every authenticated route, per client IP. */
  requestsPerHour: number;
  /** Pairing attempts per client IP (the pairing code is long, this just stops hammering). */
  pairPerHour: number;
  /** Recipes sent per inbox. */
  pushPerHour: number;
}

export interface RelayConfig {
  pairingCode: string;
  /** Origins allowed to call the relay from a browser (the app). */
  appOrigins: string[];
  /** How long an uncollected recipe waits before it is deleted. */
  ttlSeconds: number;
  maxPending: number;
  maxInboxes: number;
  listLimit: number;
  limits: RelayLimits;
}

export const DEFAULT_CONFIG: RelayConfig = {
  pairingCode: "",
  appOrigins: [],
  ttlSeconds: 7 * 24 * 60 * 60,
  maxPending: 50,
  maxInboxes: 5,
  listLimit: 50,
  limits: { requestsPerHour: 300, pairPerHour: 10, pushPerHour: 30 },
};

export interface RelayDeps {
  store: Store;
  config: RelayConfig;
  now?: () => number;
  newId?: () => string;
}

const HOUR = 60 * 60;
const MAX_ACK_IDS = 100;

const ROUTES: Record<string, { route: "health" | "pair" | "inbox" | "ack"; methods: string[] }> = {
  "/api/health": { route: "health", methods: ["GET"] },
  "/api/pair": { route: "pair", methods: ["POST", "DELETE"] },
  "/api/inbox": { route: "inbox", methods: ["GET", "POST"] },
  "/api/inbox/ack": { route: "ack", methods: ["POST"] },
};

type ErrorCode =
  | "unauthorized"
  | "forbidden"
  | "too_many_inboxes"
  | "not_a_recipe"
  | "empty"
  | "bad_json"
  | "bad_request"
  | "too_large"
  | "inbox_full"
  | "rate_limited"
  | "not_found"
  | "method_not_allowed"
  | "server_error";

const MESSAGES: Record<ErrorCode, string> = {
  unauthorized: "CulinaryLog: this Shortcut's secret isn't recognised. Copy it again from Settings → Gemini in the app.",
  forbidden: "CulinaryLog: that pairing code isn't right.",
  too_many_inboxes: "CulinaryLog: this relay already has as many devices connected as it allows.",
  not_a_recipe: "CulinaryLog: that doesn't look like a recipe, so nothing was sent.",
  empty: "CulinaryLog: there was nothing to send. Copy the recipe first.",
  bad_json: "CulinaryLog: the request wasn't valid JSON.",
  bad_request: "CulinaryLog: the request wasn't understood.",
  too_large: "CulinaryLog: that recipe is too long to send.",
  inbox_full: "CulinaryLog: too many recipes are waiting. Open the app to collect them, then try again.",
  rate_limited: "CulinaryLog: too many requests. Try again in a little while.",
  not_found: "Not found.",
  method_not_allowed: "Method not allowed.",
  server_error: "CulinaryLog: the relay had a problem. Try again, or use Paste & save in the app.",
};

interface Ctx {
  cors: Record<string, string>;
  /** Reply in plain text (the Shortcut's notification) instead of JSON. */
  plain: boolean;
}

const BASE_HEADERS = { "cache-control": "no-store", "x-content-type-options": "nosniff" };

function json(ctx: Ctx, status: number, body: unknown, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...BASE_HEADERS, ...ctx.cors, ...extra, "content-type": "application/json; charset=utf-8" },
  });
}

function text(ctx: Ctx, status: number, message: string): Response {
  return new Response(message, {
    status,
    headers: { ...BASE_HEADERS, ...ctx.cors, "content-type": "text/plain; charset=utf-8" },
  });
}

function fail(ctx: Ctx, status: number, error: ErrorCode, extra: Record<string, string> = {}): Response {
  const message = MESSAGES[error];
  return ctx.plain ? text(ctx, status, message) : json(ctx, status, { error, message }, extra);
}

function corsHeaders(origin: string | null, allowed: string[]): Record<string, string> {
  return origin && allowed.includes(origin) ? { vary: "Origin", "access-control-allow-origin": origin } : { vary: "Origin" };
}

function preflight(ctx: Ctx, methods: string[]): Response {
  const granted = "access-control-allow-origin" in ctx.cors;
  return new Response(null, {
    status: 204,
    headers: {
      ...ctx.cors,
      ...(granted
        ? {
            "access-control-allow-methods": [...methods, "OPTIONS"].join(", "),
            "access-control-allow-headers": "Authorization, Content-Type",
            "access-control-max-age": "600",
          }
        : {}),
    },
  });
}

/** "/api/inbox", also when a rewrite delivers it as "/api?route=inbox". */
function routePath(url: URL): string {
  const path = url.pathname.replace(/\/+$/, "");
  const route = url.searchParams.get("route");
  if ((path === "/api" || path === "/api/index") && route) return `/api/${route.replace(/^\/+/, "")}`;
  return path;
}

function clientIp(request: Request): string {
  return (
    request.headers.get("x-real-ip")?.trim() ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

/** The body as text, or "too_large". Multipart forms (a Shortcut's "Form" body) yield their text field. */
async function readBody(request: Request): Promise<{ type: string | null; body: string } | "too_large"> {
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) return "too_large";
  const type = request.headers.get("content-type");
  if (type?.toLowerCase().startsWith("multipart/form-data")) {
    const form = await request.formData();
    const value = form.get("text") ?? form.get("markdown");
    const body = typeof value === "string" ? value : "";
    return body.length > MAX_BODY_BYTES ? "too_large" : { type: "text/plain", body };
  }
  const bytes = new Uint8Array(await request.arrayBuffer());
  if (bytes.byteLength > MAX_BODY_BYTES) return "too_large";
  return { type, body: new TextDecoder().decode(bytes) };
}

async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  const read = await readBody(request);
  if (read === "too_large") return null;
  try {
    const value: unknown = JSON.parse(read.body);
    return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function isAckIds(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.length <= MAX_ACK_IDS &&
    value.every((id) => typeof id === "string" && id.length > 0 && id.length <= 64)
  );
}

export async function handleRequest(request: Request, deps: RelayDeps): Promise<Response> {
  const { store, config } = deps;
  const now = deps.now ?? Date.now;
  const newId = deps.newId ?? (() => crypto.randomUUID());
  const method = request.method.toUpperCase();
  const entry = ROUTES[routePath(new URL(request.url))];
  const ctx: Ctx = {
    cors: corsHeaders(request.headers.get("origin"), config.appOrigins),
    plain: entry?.route === "inbox" && method === "POST" && !(request.headers.get("accept") ?? "").includes("application/json"),
  };

  if (!entry) return fail(ctx, 404, "not_found");
  if (method === "OPTIONS") return preflight(ctx, entry.methods);
  if (!entry.methods.includes(method)) {
    return fail(ctx, 405, "method_not_allowed", { allow: [...entry.methods, "OPTIONS"].join(", ") });
  }
  if (entry.route === "health") return json(ctx, 200, { ok: true, service: "culinarylog-relay" });

  try {
    const ip = clientIp(request);
    if ((await store.hit(`ip:${ip}`, HOUR)) > config.limits.requestsPerHour) return fail(ctx, 429, "rate_limited");
    if (entry.route === "pair" && method === "POST" && (await store.hit(`pair:${ip}`, HOUR)) > config.limits.pairPerHour) {
      return fail(ctx, 429, "rate_limited");
    }

    const token = bearerToken(request);
    if (!token) return fail(ctx, 401, "unauthorized");
    const inboxId = await sha256Hex(token);
    const fingerprint = await pairingFingerprint(config.pairingCode);

    if (entry.route === "pair" && method === "POST") {
      const body = await readJson(request);
      const code = typeof body?.code === "string" ? body.code : "";
      if (!config.pairingCode || !(await safeEqual(code, config.pairingCode))) return fail(ctx, 403, "forbidden");
      const result = await store.register(inboxId, fingerprint, config.maxInboxes);
      if (result === "full") return fail(ctx, 409, "too_many_inboxes");
      return json(ctx, result === "registered" ? 201 : 200, { ok: true });
    }

    if ((await store.getRegistration(inboxId)) !== fingerprint) return fail(ctx, 401, "unauthorized");

    if (entry.route === "pair") {
      await store.unregister(inboxId);
      return json(ctx, 200, { ok: true });
    }

    if (entry.route === "ack") {
      const ids = (await readJson(request))?.ids;
      if (!isAckIds(ids)) return fail(ctx, 400, "bad_request");
      return json(ctx, 200, { deleted: await store.ack(inboxId, ids) });
    }

    if (method === "GET") return json(ctx, 200, { items: await store.list(inboxId, config.listLimit) });

    // POST /api/inbox: a recipe from the Shortcut.
    if ((await store.hit(`push:${inboxId}`, HOUR)) > config.limits.pushPerHour) return fail(ctx, 429, "rate_limited");
    const read = await readBody(request);
    if (read === "too_large") return fail(ctx, 413, "too_large");
    const payload = readRecipeText(read.type, read.body);
    if (!payload.ok) {
      const status = payload.error === "too_large" ? 413 : payload.error === "bad_json" ? 400 : 422;
      return fail(ctx, status, payload.error);
    }
    const item: InboxItem = { id: newId(), text: payload.text, title: payload.title, source: "shortcut", receivedAt: now() };
    const result = await store.push(inboxId, item, {
      dedupeKey: (await sha256Hex(payload.text)).slice(0, 32),
      ttlSeconds: config.ttlSeconds,
      maxPending: config.maxPending,
    });
    if (result.status === "full") return fail(ctx, 507, "inbox_full");
    if (result.status === "duplicate") {
      // Silent for the Shortcut: an automation may send the same clipboard again and again.
      if (ctx.plain) return new Response(null, { status: 204, headers: { ...BASE_HEADERS, ...ctx.cors } });
      return json(ctx, 200, { ok: true, id: result.id, title: payload.title, duplicate: true });
    }
    if (ctx.plain) return text(ctx, 201, payload.title ? `Sent “${payload.title}” to CulinaryLog.` : "Sent to CulinaryLog.");
    return json(ctx, 201, { ok: true, id: item.id, title: item.title, duplicate: false });
  } catch {
    return fail(ctx, 500, "server_error");
  }
}

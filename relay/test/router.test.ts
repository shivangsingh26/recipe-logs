import { beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_CONFIG, handleRequest, type RelayConfig, type RelayDeps } from "../lib/router.js";
import { createMemoryStore, type Store } from "../lib/store.js";
import { RECIPE, RECIPE_V2 } from "./fixtures.js";

const APP = "https://me.github.io";
const CODE = "pairing-code-0123456789";
const TOKEN = "a".repeat(43);
const OTHER_TOKEN = "b".repeat(43);

interface CallOptions {
  token?: string;
  body?: string;
  type?: string;
  origin?: string;
  accept?: string;
  ip?: string;
}

let deps: RelayDeps;

function makeDeps(config: Partial<RelayConfig> = {}, store: Store = createMemoryStore()): RelayDeps {
  let n = 0;
  return {
    store,
    config: { ...DEFAULT_CONFIG, pairingCode: CODE, appOrigins: [APP], ...config },
    newId: () => `item-${++n}`,
  };
}

function call(method: string, path: string, options: CallOptions = {}): Promise<Response> {
  const headers = new Headers();
  if (options.token) headers.set("authorization", `Bearer ${options.token}`);
  if (options.type) headers.set("content-type", options.type);
  if (options.origin) headers.set("origin", options.origin);
  if (options.accept) headers.set("accept", options.accept);
  headers.set("x-forwarded-for", options.ip ?? "203.0.113.7");
  return handleRequest(new Request(`https://relay.example${path}`, { method, headers, body: options.body }), deps);
}

const pair = (token = TOKEN, code = CODE) =>
  call("POST", "/api/pair", { token, type: "application/json", body: JSON.stringify({ code }), origin: APP });
const send = (text: string, options: CallOptions = {}) =>
  call("POST", "/api/inbox", { token: TOKEN, type: "text/plain", body: text, ...options });
const list = (token = TOKEN) => call("GET", "/api/inbox", { token, origin: APP });

beforeEach(() => {
  deps = makeDeps();
});

describe("routing", () => {
  it("answers the health check", async () => {
    const res = await call("GET", "/api/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, service: "culinarylog-relay" });
  });

  it("returns 404 for unknown paths and 405 for unknown methods", async () => {
    expect((await call("GET", "/api/nope")).status).toBe(404);
    const res = await call("PUT", "/api/inbox", { token: TOKEN });
    expect(res.status).toBe(405);
    expect(res.headers.get("allow")).toBe("GET, POST, OPTIONS");
  });

  it("accepts the route as a query parameter (rewrite to /api)", async () => {
    expect((await call("GET", "/api?route=health")).status).toBe(200);
  });
});

describe("CORS", () => {
  it("answers preflight requests from the app's origin", async () => {
    const res = await call("OPTIONS", "/api/inbox", { origin: APP });
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe(APP);
    expect(res.headers.get("access-control-allow-headers")).toContain("Authorization");
    expect(res.headers.get("vary")).toContain("Origin");
  });

  it("does not grant other origins", async () => {
    await pair();
    const res = await call("GET", "/api/inbox", { token: TOKEN, origin: "https://evil.example" });
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
    expect((await call("OPTIONS", "/api/inbox", { origin: "https://evil.example" })).headers.get(
      "access-control-allow-origin",
    )).toBeNull();
  });
});

describe("pairing", () => {
  it("needs a well-formed bearer token", async () => {
    expect((await pair("short")).status).toBe(401);
    expect((await call("POST", "/api/pair", { type: "application/json", body: JSON.stringify({ code: CODE }) })).status).toBe(
      401,
    );
  });

  it("rejects a wrong pairing code", async () => {
    expect((await pair(TOKEN, "wrong")).status).toBe(403);
    expect((await list()).status).toBe(401);
  });

  it("registers the inbox once and is idempotent", async () => {
    expect((await pair()).status).toBe(201);
    expect((await pair()).status).toBe(200);
    expect((await list()).status).toBe(200);
  });

  it("caps the number of inboxes", async () => {
    deps = makeDeps({ maxInboxes: 1 });
    await pair();
    const res = await pair(OTHER_TOKEN);
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ error: "too_many_inboxes" });
  });

  it("limits pairing attempts per IP", async () => {
    deps = makeDeps({ limits: { ...DEFAULT_CONFIG.limits, pairPerHour: 2 } });
    await pair(TOKEN, "wrong");
    await pair(TOKEN, "wrong");
    expect((await pair()).status).toBe(429);
  });

  it("revokes every inbox when the pairing code changes", async () => {
    const store = createMemoryStore();
    deps = makeDeps({}, store);
    await pair();
    deps = makeDeps({ pairingCode: "a-brand-new-pairing-code" }, store);
    expect((await list()).status).toBe(401);
    expect((await send(RECIPE)).status).toBe(401);
  });

  it("unpairing deletes the inbox and its recipes", async () => {
    await pair();
    await send(RECIPE);
    const res = await call("DELETE", "/api/pair", { token: TOKEN, origin: APP });
    expect(res.status).toBe(200);
    expect((await list()).status).toBe(401);
    await pair();
    expect(await (await list()).json()).toEqual({ items: [] });
  });
});

describe("sending (the Shortcut)", () => {
  beforeEach(async () => {
    await pair();
  });

  it("stores a recipe and replies with a message for the notification", async () => {
    const res = await send(RECIPE);
    expect(res.status).toBe(201);
    expect(res.headers.get("content-type")).toMatch(/^text\/plain/);
    expect(await res.text()).toBe("Sent “Anda Bhurji” to CulinaryLog.");
  });

  it("replies with JSON when asked", async () => {
    const res = await send(JSON.stringify({ text: RECIPE }), { type: "application/json", accept: "application/json" });
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ ok: true, id: "item-1", title: "Anda Bhurji", duplicate: false });
  });

  it("accepts a multipart form body", async () => {
    const form = new FormData();
    form.set("text", RECIPE);
    const request = new Request("https://relay.example/api/inbox", {
      method: "POST",
      headers: { authorization: `Bearer ${TOKEN}` },
      body: form,
    });
    expect((await handleRequest(request, deps)).status).toBe(201);
  });

  it("stays silent when the same recipe is sent again", async () => {
    await send(RECIPE);
    const res = await send(RECIPE);
    expect(res.status).toBe(204);
    expect(await res.text()).toBe("");
    const json = await send(RECIPE, { accept: "application/json" });
    expect(await json.json()).toEqual({ ok: true, id: "item-1", title: "Anda Bhurji", duplicate: true });
    expect((await (await list()).json()).items).toHaveLength(1);
  });

  it("stores a changed version of the same dish as a new item", async () => {
    await send(RECIPE);
    expect((await send(RECIPE_V2)).status).toBe(201);
    expect((await (await list()).json()).items).toHaveLength(2);
  });

  it("refuses an unknown secret", async () => {
    const res = await send(RECIPE, { token: OTHER_TOKEN });
    expect(res.status).toBe(401);
    expect(await res.text()).toMatch(/secret isn't recognised/);
  });

  it("refuses text that is not a recipe", async () => {
    const res = await send("my bank PIN is 1234");
    expect(res.status).toBe(422);
    expect(await res.text()).toMatch(/doesn't look like a recipe/);
  });

  it("refuses bodies over 64 KB", async () => {
    expect((await send(`${RECIPE}\n${"x".repeat(70 * 1024)}`)).status).toBe(413);
  });

  it("refuses new recipes while the inbox is full", async () => {
    deps.config = { ...deps.config, maxPending: 1 };
    await send(RECIPE);
    const res = await send(RECIPE_V2);
    expect(res.status).toBe(507);
    expect(await res.text()).toMatch(/Open the app/);
  });

  it("limits sends per inbox", async () => {
    deps.config = { ...deps.config, limits: { ...deps.config.limits, pushPerHour: 1 } };
    await send(RECIPE);
    expect((await send(RECIPE_V2)).status).toBe(429);
  });
});

describe("collecting (the app)", () => {
  beforeEach(async () => {
    await pair();
  });

  it("lists waiting recipes without caching", async () => {
    await send(RECIPE);
    const res = await list();
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(res.headers.get("access-control-allow-origin")).toBe(APP);
    const { items } = await res.json();
    expect(items).toEqual([
      { id: "item-1", text: RECIPE, title: "Anda Bhurji", source: "shortcut", receivedAt: expect.any(Number) },
    ]);
  });

  it("deletes acknowledged recipes", async () => {
    await send(RECIPE);
    const ack = await call("POST", "/api/inbox/ack", {
      token: TOKEN,
      origin: APP,
      type: "application/json",
      body: JSON.stringify({ ids: ["item-1"] }),
    });
    expect(ack.status).toBe(200);
    expect(await ack.json()).toEqual({ deleted: 1 });
    expect(await (await list()).json()).toEqual({ items: [] });
  });

  it("rejects malformed acknowledgements", async () => {
    for (const body of ["nope", JSON.stringify({ ids: "item-1" }), JSON.stringify({ ids: [] })]) {
      const res = await call("POST", "/api/inbox/ack", { token: TOKEN, type: "application/json", body });
      expect(res.status).toBe(400);
    }
  });
});

describe("limits and failures", () => {
  it("limits requests per IP", async () => {
    deps = makeDeps({ limits: { ...DEFAULT_CONFIG.limits, requestsPerHour: 2 } });
    await pair();
    await list();
    expect((await list()).status).toBe(429);
    expect((await list()).status).toBe(429);
  });

  it("reports storage failures without leaking details", async () => {
    const broken = createMemoryStore();
    broken.getRegistration = async () => {
      throw new Error("ECONNRESET redis://secret@host");
    };
    deps = makeDeps({}, broken);
    const res = await send(RECIPE);
    expect(res.status).toBe(500);
    expect(await res.text()).not.toContain("secret");
  });
});

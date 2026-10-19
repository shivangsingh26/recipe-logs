import { describe, expect, it } from "vitest";
import { createInboxClient, InboxError, parseInboxItems } from "./client";

const RELAY = "https://relay.example.app";
const TOKEN = "t".repeat(43);

interface Call {
  url: string;
  init: RequestInit;
}

function fakeFetch(respond: (call: Call) => Response | Promise<Response>) {
  const calls: Call[] = [];
  const impl = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const call = { url: String(input), init };
    calls.push(call);
    return respond(call);
  }) as typeof fetch;
  return { calls, impl };
}

const item = { id: "item-1", text: "# Dal\n## Ingredients\n- dal\n- water", title: "Dal", source: "shortcut", receivedAt: 5 };

describe("parseInboxItems", () => {
  it("keeps well-formed items and drops the rest", () => {
    expect(
      parseInboxItems({
        items: [item, { ...item, id: "" }, { ...item, text: 7 }, { id: "x", text: "y" }, "junk", { ...item, id: "item-2", title: 3 }],
      }),
    ).toEqual([item, { ...item, id: "item-2", title: "" }]);
  });

  it("returns nothing for a malformed body", () => {
    expect(parseInboxItems(null)).toEqual([]);
    expect(parseInboxItems({ items: "nope" })).toEqual([]);
  });
});

describe("createInboxClient", () => {
  it("lists waiting recipes with the bearer token and no caching", async () => {
    const { calls, impl } = fakeFetch(() => Response.json({ items: [item] }));
    expect(await createInboxClient(RELAY, TOKEN, impl).list()).toEqual([item]);
    expect(calls[0].url).toBe(`${RELAY}/api/inbox`);
    expect(new Headers(calls[0].init.headers).get("authorization")).toBe(`Bearer ${TOKEN}`);
    expect(calls[0].init).toMatchObject({ method: "GET", cache: "no-store", credentials: "omit" });
  });

  it("acknowledges saved recipes", async () => {
    const { calls, impl } = fakeFetch(() => Response.json({ deleted: 2 }));
    await createInboxClient(RELAY, TOKEN, impl).ack(["a", "b"]);
    expect(calls[0].url).toBe(`${RELAY}/api/inbox/ack`);
    expect(calls[0].init.method).toBe("POST");
    expect(JSON.parse(String(calls[0].init.body))).toEqual({ ids: ["a", "b"] });
  });

  it("skips the request when there is nothing to acknowledge", async () => {
    const { calls, impl } = fakeFetch(() => Response.json({ deleted: 0 }));
    await createInboxClient(RELAY, TOKEN, impl).ack([]);
    expect(calls).toHaveLength(0);
  });

  it("pairs and unpairs the inbox", async () => {
    const { calls, impl } = fakeFetch(() => Response.json({ ok: true }, { status: 201 }));
    const client = createInboxClient(RELAY, TOKEN, impl);
    await client.pair("pairing-code-0123456789");
    await client.unpair();
    expect(calls.map((c) => `${c.init.method} ${c.url}`)).toEqual([`POST ${RELAY}/api/pair`, `DELETE ${RELAY}/api/pair`]);
    expect(JSON.parse(String(calls[0].init.body))).toEqual({ code: "pairing-code-0123456789" });
  });

  it.each([
    [401, "unauthorized"],
    [403, "wrong_code"],
    [409, "too_many_devices"],
    [429, "rate_limited"],
    [500, "server"],
    [404, "server"],
  ])("maps HTTP %i to %s", async (status, kind) => {
    const { impl } = fakeFetch(() => Response.json({ error: "x" }, { status }));
    await expect(createInboxClient(RELAY, TOKEN, impl).list()).rejects.toMatchObject({ kind });
  });

  it("reports network failures as offline", async () => {
    const { impl } = fakeFetch(() => {
      throw new TypeError("Load failed");
    });
    const error = await createInboxClient(RELAY, TOKEN, impl).list().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(InboxError);
    expect(error).toMatchObject({ kind: "offline" });
  });

  it("reports a non-JSON answer as a bad response", async () => {
    const { impl } = fakeFetch(() => new Response("<html>", { status: 200 }));
    await expect(createInboxClient(RELAY, TOKEN, impl).list()).rejects.toMatchObject({ kind: "bad_response" });
  });

  it("gives up on a relay that does not answer", async () => {
    const { impl } = fakeFetch(
      ({ init }) =>
        new Promise((_, reject) => init.signal?.addEventListener("abort", () => reject(new DOMException("", "AbortError")))),
    );
    await expect(createInboxClient(RELAY, TOKEN, impl, 20).list()).rejects.toMatchObject({ kind: "offline" });
  });
});

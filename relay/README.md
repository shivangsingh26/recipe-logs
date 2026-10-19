# CulinaryLog relay

A tiny store-and-forget inbox that lets an iPhone Shortcut send a recipe copied in the Gemini app
to CulinaryLog. The app is local-first and has no server, and a home-screen web app can't receive
anything while it is closed, so the Shortcut drops the recipe here and the app collects it the
next time it opens.

```
Gemini (copy) → Shortcut ──POST /api/inbox──▶ relay (Vercel + Upstash Redis)
                                                 │
CulinaryLog (on open / focus / back online) ◀── GET /api/inbox, then POST /api/inbox/ack
```

## Privacy and security

- **What it holds:** only recipes you send with the Shortcut, as text. It never sees your vault,
  cook log or photos.
- **How long:** a recipe is deleted as soon as the app acknowledges it. A recipe the app never
  collects is deleted after 7 days (Redis TTL). Re-sending the same text within those 7 days is
  ignored.
- **Who can use it:**
  - Each device's inbox is guarded by a random 256-bit secret that the app generates. The relay
    stores only its SHA-256.
  - Connecting a device needs the deployment's `PAIRING_CODE`, so strangers can't create inboxes.
  - Changing `PAIRING_CODE` (and redeploying) disconnects every device.
- **Limits:**

  | What | Limit |
  | --- | --- |
  | Request body | 64 KB |
  | Waiting recipes per inbox | 50 |
  | Devices | 5 |
  | Recipes sent | 30 per hour per inbox |
  | Pairing attempts | 10 per hour per IP |
  | Requests | 300 per hour per IP |

- **CORS** is limited to `APP_ORIGINS`. The Shortcut isn't a browser, so CORS doesn't apply to
  it; the secret is what protects the inbox.
- Text that doesn't look like a recipe (no "Ingredients" plus list items) is refused. The app
  parses and sanitises everything again before saving.

## API

| Method and path | Auth | Body | Answer |
| --- | --- | --- | --- |
| `GET /api/health` | none | | `{ ok: true }` |
| `POST /api/pair` | `Bearer <secret>` | `{ "code": PAIRING_CODE }` | 201 paired / 200 already / 403 wrong code / 409 too many devices |
| `DELETE /api/pair` | `Bearer <secret>` | | Unpairs and deletes waiting recipes |
| `POST /api/inbox` | `Bearer <secret>` | JSON `{ "text" }`, `text/plain`, or form `text=` | 201 "Sent “Title” to CulinaryLog." / 204 duplicate / 422 not a recipe / 413 / 429 / 507 inbox full |
| `GET /api/inbox` | `Bearer <secret>` | | `{ items: [{ id, text, title, source, receivedAt }] }`, oldest first |
| `POST /api/inbox/ack` | `Bearer <secret>` | `{ "ids": [...] }` | `{ deleted }` |

`POST /api/inbox` answers in plain text, so the Shortcut can show the reply as a notification.
Send `Accept: application/json` to get JSON instead.

## Configuration

| Variable | Notes |
| --- | --- |
| `PAIRING_CODE` | Required, 16+ characters. Generate one with `openssl rand -base64 24 \| tr '+/' '-_' \| tr -d '='`. |
| `APP_ORIGINS` | Comma-separated origins of the app, e.g. `https://you.github.io`. Origin only, no path. |
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` | Added by the Vercel Marketplace Upstash integration. `UPSTASH_REDIS_REST_URL` / `_TOKEN` work too. |

## Deploy (Vercel + Upstash, free tiers)

Deploy this folder as its own Vercel project, separate from the static app.

1. `cd relay && vercel link`, and create a new project (for example `culinarylog-relay`).
2. In the Vercel dashboard, open the project → **Storage** → create an **Upstash for Redis**
   database (free plan) and connect it to the project. This adds the `KV_REST_API_*` variables.
3. Set the two variables:
   - `vercel env add PAIRING_CODE production`
   - `vercel env add APP_ORIGINS production`
4. Run `vercel deploy --prod`, then check it with `curl https://<project>.vercel.app/api/health`.
5. Your connection code is `https://<project>.vercel.app/#pair=<PAIRING_CODE>`. Paste it into
   CulinaryLog → Settings → Gemini.

## Develop

```bash
npm install
npm test            # handlers, payload rules, both stores (Redis via an in-memory fake)
npm run typecheck
npm run dev         # http://localhost:8787, in-memory store, PAIRING_CODE=local-dev-pairing-code
```

The app accepts `http://localhost` relays, so the local connection code
`http://localhost:8787/#pair=local-dev-pairing-code` works with `npm run dev` / `npm run preview`
in the app folder.

## Later: Gemini custom app (MCP)

Gemini's custom MCP apps would let "save it" call a `save_recipe` tool directly. As of October
2026 they are US-only. The relay is shaped for it:

- A `/mcp` endpoint would reuse `store.push` with `source: "mcp"`.
- It would need OAuth (Dynamic Client Registration, plus a consent page that takes the pairing
  code).

See `../docs/automation-options.md`.

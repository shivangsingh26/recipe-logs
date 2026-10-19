// Local relay for development and end-to-end checks: the same handler as on Vercel, with an
// in-memory store (everything is lost when it stops).
//
//   npm run dev                                  # http://localhost:8787
//   PORT=9000 PAIRING_CODE=… APP_ORIGINS=… npm run dev

import { createServer } from "node:http";
import { configFromEnv } from "../lib/config.js";
import { handleRequest } from "../lib/router.js";
import { createMemoryStore } from "../lib/store.js";

const port = Number(process.env.PORT ?? 8787);
const config = configFromEnv({
  PAIRING_CODE: process.env.PAIRING_CODE ?? "local-dev-pairing-code",
  APP_ORIGINS: process.env.APP_ORIGINS ?? "http://localhost:3000,http://localhost:4173",
});
const deps = { config, store: createMemoryStore() };

const server = createServer(async (req, res) => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const headers = new Headers();
  for (const [name, value] of Object.entries(req.headers)) {
    if (typeof value === "string") headers.set(name, value);
    else if (Array.isArray(value)) headers.set(name, value.join(", "));
  }
  headers.set("x-real-ip", req.socket.remoteAddress ?? "local");
  const hasBody = req.method !== "GET" && req.method !== "HEAD" && chunks.length > 0;
  const request = new Request(`http://localhost:${port}${req.url ?? "/"}`, {
    method: req.method,
    headers,
    body: hasBody ? Buffer.concat(chunks) : undefined,
  });
  const response = await handleRequest(request, deps);
  res.writeHead(response.status, Object.fromEntries(response.headers));
  res.end(Buffer.from(await response.arrayBuffer()));
  console.log(`${req.method} ${req.url} → ${response.status}`);
});

server.listen(port, () => {
  console.log(`CulinaryLog relay (in-memory) on http://localhost:${port}`);
  console.log(`Connection code: http://localhost:${port}/#pair=${config.pairingCode}`);
  console.log(`App origins: ${config.appOrigins.join(", ")}`);
});

// Zero-dependency static server for the production build in out/ (`npm run preview`).
// Serves like GitHub Pages: directories → index.html with a trailing-slash redirect,
// 404s → out/404.html, and honours NEXT_PUBLIC_BASE_PATH (e.g. /recipe-logs).
// Listens on 0.0.0.0 so a phone on the same Wi-Fi can open it.

import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { networkInterfaces } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const OUT_DIR = fileURLToPath(new URL("../out/", import.meta.url));
const PORT = Number(process.env.PORT) || 4173;
const HOST = process.env.HOST || "0.0.0.0";
const BASE_PATH = (() => {
  const trimmed = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").trim().replace(/\/+$/, "");
  return !trimmed || trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
})();

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".map": "application/json; charset=utf-8",
};

/** HTML, the service worker and the manifest must revalidate; hashed build assets never change. */
function cacheControl(urlPath, ext) {
  if (urlPath.startsWith("/_next/static/")) return "public, max-age=31536000, immutable";
  if (ext === ".html" || ext === ".webmanifest" || urlPath === "/sw.js") return "no-cache";
  return "public, max-age=0, must-revalidate";
}

async function statOrNull(filePath) {
  try {
    return await stat(filePath);
  } catch {
    return null;
  }
}

async function sendFile(req, res, filePath, fileStat, status, urlPath) {
  const ext = path.extname(filePath).toLowerCase();
  const lastModified = fileStat.mtime.toUTCString();
  const headers = {
    "Content-Type": MIME[ext] ?? "application/octet-stream",
    "Cache-Control": cacheControl(urlPath, ext),
    "Last-Modified": lastModified,
    "X-Content-Type-Options": "nosniff",
  };
  const since = req.headers["if-modified-since"];
  if (status === 200 && since && Date.parse(since) >= Math.floor(fileStat.mtimeMs / 1000) * 1000) {
    res.writeHead(304, headers).end();
    return;
  }
  res.writeHead(status, { ...headers, "Content-Length": fileStat.size });
  if (req.method === "HEAD") res.end();
  else createReadStream(filePath).pipe(res);
}

async function sendNotFound(req, res) {
  const page = path.join(OUT_DIR, "404.html");
  const pageStat = await statOrNull(page);
  if (pageStat) return sendFile(req, res, page, pageStat, 404, "/404.html");
  res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("Not found");
}

function redirect(res, location) {
  res.writeHead(301, { Location: location, "Cache-Control": "no-cache" }).end();
}

async function handle(req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, { Allow: "GET, HEAD" }).end();
    return;
  }
  const url = new URL(req.url ?? "/", "http://localhost");
  let pathname;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    res.writeHead(400).end("Bad request");
    return;
  }

  if (BASE_PATH) {
    if (pathname === "/" || pathname === BASE_PATH) return redirect(res, `${BASE_PATH}/${url.search}`);
    if (!pathname.startsWith(`${BASE_PATH}/`)) return sendNotFound(req, res);
  }
  const urlPath = pathname.slice(BASE_PATH.length) || "/";

  let filePath = path.join(OUT_DIR, urlPath);
  // path.join normalises "..": anything that escapes out/ is treated as missing.
  if (filePath !== OUT_DIR.slice(0, -1) && !filePath.startsWith(OUT_DIR)) return sendNotFound(req, res);

  let fileStat = await statOrNull(filePath);
  if (fileStat?.isDirectory()) {
    if (!urlPath.endsWith("/")) return redirect(res, `${url.pathname}/${url.search}`);
    filePath = path.join(filePath, "index.html");
    fileStat = await statOrNull(filePath);
  }
  if (!fileStat?.isFile()) return sendNotFound(req, res);
  return sendFile(req, res, filePath, fileStat, 200, urlPath);
}

const server = createServer((req, res) => {
  handle(req, res).catch((error) => {
    console.error(error);
    if (!res.headersSent) res.writeHead(500).end("Server error");
  });
});

server.listen(PORT, HOST, () => {
  const lan = Object.values(networkInterfaces())
    .flat()
    .filter((net) => net && net.family === "IPv4" && !net.internal)
    .map((net) => `http://${net.address}:${PORT}${BASE_PATH}/`);
  console.log(`CulinaryLog preview (out/) → http://localhost:${PORT}${BASE_PATH}/`);
  for (const address of lan) console.log(`  on your Wi-Fi           → ${address}`);
  if (lan.length > 0) {
    console.log("  (offline mode needs HTTPS or localhost; over plain http on Wi-Fi the app runs online-only)");
  }
});

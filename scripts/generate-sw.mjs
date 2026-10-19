// Runs after `next build` (see "build" in package.json). Lists every file of the static
// export, hashes it, and writes out/sw.js from scripts/sw-template.js with the precache
// list and a version derived from the content, so any change ships a new service worker.
// Also writes out/.nojekyll: GitHub Pages' Jekyll step would otherwise drop `_next/`.

import { createHash } from "node:crypto";
import { access, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const OUT_DIR = path.join(ROOT, "out");
const TEMPLATE = path.join(ROOT, "scripts", "sw-template.js");

/** Same rule as next.config.ts ("/recipe-logs/" → "/recipe-logs"), plus a leading slash. */
function normalizeBasePath(raw) {
  const trimmed = (raw ?? "").trim().replace(/\/+$/, "");
  if (!trimmed) return "";
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

function shouldSkip(relPath) {
  const name = path.posix.basename(relPath);
  return relPath === "sw.js" || name === ".DS_Store" || name === ".nojekyll" || name.endsWith(".map");
}

async function listFiles(dir, prefix = "") {
  const files = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) files.push(...(await listFiles(path.join(dir, entry.name), rel)));
    else if (entry.isFile() && !shouldSkip(rel)) files.push(rel);
  }
  return files;
}

/** Escapes only what would change how the URL parses; the browser normalises the rest the same way. */
function toUrlPath(relPath) {
  return relPath
    .split("/")
    .map((segment) => segment.replace(/[%#?]/g, (char) => encodeURIComponent(char)))
    .join("/");
}

/** A file's URL, plus the directory URL that serves it for pages ("recipe/index.html" → "/recipe/"). */
function urlsFor(relPath, basePath) {
  const url = `${basePath}/${toUrlPath(relPath)}`;
  if (relPath === "index.html" || relPath.endsWith("/index.html")) {
    return [url, url.slice(0, -"index.html".length)];
  }
  return [url];
}

const shortHash = (data, length) => createHash("sha256").update(data).digest("hex").slice(0, length);

async function main() {
  try {
    await access(OUT_DIR);
  } catch {
    throw new Error("out/ not found. Run `next build` (static export) first.");
  }
  const basePath = normalizeBasePath(process.env.NEXT_PUBLIC_BASE_PATH);
  const files = (await listFiles(OUT_DIR)).sort();

  let totalBytes = 0;
  const entries = [];
  for (const rel of files) {
    const content = await readFile(path.join(OUT_DIR, rel));
    totalBytes += content.length;
    const hash = shortHash(content, 12);
    for (const url of urlsFor(rel, basePath)) entries.push([url, hash]);
  }
  entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const version = shortHash(entries.map(([url, hash]) => `${url} ${hash}`).join("\n"), 10);

  const precache = `[\n${entries.map((entry) => `  ${JSON.stringify(entry)},`).join("\n")}\n]`;
  const template = await readFile(TEMPLATE, "utf8");
  const sw = template
    .replace('"%%VERSION%%"', JSON.stringify(version))
    .replace('"%%BASE_PATH%%"', JSON.stringify(basePath))
    .replace("/* %%PRECACHE%% */ []", precache);
  if (sw.includes("%%")) throw new Error("scripts/sw-template.js: a placeholder was not replaced.");

  await writeFile(path.join(OUT_DIR, "sw.js"), sw);
  await writeFile(path.join(OUT_DIR, ".nojekyll"), "");

  const kb = Math.round(totalBytes / 1024).toLocaleString("en");
  console.log(
    `sw.js: version ${version}, ${files.length} files (${entries.length} URLs, ${kb} KB) precached` +
      (basePath ? `, base path ${basePath}` : ""),
  );
}

main().catch((error) => {
  console.error(`generate-sw: ${error instanceof Error ? error.message : error}`);
  process.exit(1);
});

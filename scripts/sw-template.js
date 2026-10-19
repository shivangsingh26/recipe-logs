/* CulinaryLog service worker, generated from scripts/sw-template.js by scripts/generate-sw.mjs. */

// Filled in at build time: the build's version hash, the deploy base path ("" or
// "/recipe-logs") and [url, contentHash] for every file in out/.
const VERSION = "%%VERSION%%";
const BASE_PATH = "%%BASE_PATH%%";
const PRECACHE = /* %%PRECACHE%% */ [];

const CACHE_PREFIX = "culinarylog-";
const CACHE_NAME = `${CACHE_PREFIX}${VERSION}`;
const SCOPE_PATH = `${BASE_PATH}/`;
const PRECACHED = new Set(PRECACHE.map(([url]) => url));
// Static files: the Vary headers some hosts add (e.g. Accept-Encoding) must not cause misses.
const MATCH_PAGE = { ignoreVary: true };
const MATCH_ASSET = { ignoreSearch: true, ignoreVary: true };

// ── Install: download the whole app, bypassing the HTTP cache ────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await cache.addAll(PRECACHE.map(([url]) => new Request(url, { cache: "reload" })));
      // Very first install: nothing to update from, so take over straight away. Updates
      // wait until the page asks (SKIP_WAITING) so a running timer is never interrupted.
      if (!self.registration.active) await self.skipWaiting();
    })(),
  );
});

// ── Activate: drop older versions, control open pages ────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names.filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME).map((name) => caches.delete(name)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

// ── Fetch ────────────────────────────────────────────────────────────────────
/**
 * The precached page for a navigation. Ids travel in the query ("/recipe/?id=x"), so the
 * query is ignored; "/recipe" and "/recipe/index.html" both map to "/recipe/".
 */
function pageKey(pathname) {
  let path = pathname;
  if (path.endsWith("/index.html")) path = path.slice(0, -"index.html".length);
  else if (!path.endsWith("/") && !path.slice(path.lastIndexOf("/") + 1).includes(".")) path += "/";
  return PRECACHED.has(path) ? path : null;
}

async function handleNavigation(request, url) {
  const cache = await caches.open(CACHE_NAME);
  const key = pageKey(url.pathname);
  const cached = key ? await cache.match(key, MATCH_PAGE) : undefined;
  if (cached) return cached;
  try {
    return await fetch(request);
  } catch (error) {
    const fallback =
      (await cache.match(`${BASE_PATH}/404.html`, MATCH_PAGE)) || (await cache.match(SCOPE_PATH, MATCH_PAGE));
    if (fallback) return fallback;
    throw error;
  }
}

async function handleAsset(request) {
  const cache = await caches.open(CACHE_NAME);
  // ignoreSearch also serves the RSC payloads Next.js fetches as "…/index.txt?_rsc=…".
  const cached = await cache.match(request, MATCH_ASSET);
  if (cached) return cached;
  const response = await fetch(request);
  // Keep only successful same-origin responses ("basic"); never opaque or error responses.
  if (response.ok && response.status === 200 && response.type === "basic") {
    cache.put(request, response.clone()).catch(() => {});
  }
  return response;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(SCOPE_PATH)) return;
  if (url.pathname === `${BASE_PATH}/sw.js`) return;
  event.respondWith(request.mode === "navigate" ? handleNavigation(request, url) : handleAsset(request));
});

// ── Notifications (finished timers): focus the app and open the target page ──
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  // Relative urls resolve against the scope, so "recipe/?id=x" works under any base path.
  const target = new URL(typeof data.url === "string" ? data.url : SCOPE_PATH, self.registration.scope).href;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const client = windows.find((w) => w.url.startsWith(self.registration.scope)) || windows[0];
      if (!client) {
        await self.clients.openWindow(target);
        return;
      }
      const focused = await client.focus().catch(() => client);
      if (focused.url !== target) {
        // navigate() only works on pages this worker controls; focusing is still worth it.
        await focused.navigate(target).catch(() => {});
      }
    })(),
  );
});

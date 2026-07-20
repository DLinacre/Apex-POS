/* Apex POS service worker — full offline support.
   App shell: cache-first. CDNs & demo images: stale-while-revalidate
   (opaque responses allowed). Navigations: network-first, shell fallback. */
const CACHE_VERSION = "apex-pos-v1";
const SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./db.js",
  "./app.js",
  "./manifest.json",
  "./assets/icon.svg",
  "./assets/icon-192.png",
  "./assets/icon-512.png",
  "./assets/favicon.ico"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_VERSION).then((c) => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  // Never cache Google SSO traffic
  if (url.hostname.includes("accounts.google.com") || url.hostname.includes("googleusercontent.com")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => { const copy = res.clone(); caches.open(CACHE_VERSION).then((c) => c.put("./index.html", copy)); return res; })
        .catch(() => caches.match("./index.html").then((r) => r || caches.match("./")))
    );
    return;
  }

  // Same-origin: cache-first with background refresh
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const network = fetch(request).then((res) => {
          if (res.ok) { const copy = res.clone(); caches.open(CACHE_VERSION).then((c) => c.put(request, copy)); }
          return res;
        });
        return cached || network;
      })
    );
    return;
  }

  // Cross-origin (Vue/Dexie/Chart/FontAwesome CDNs, demo images): stale-while-revalidate
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((res) => {
          if (res.ok || res.type === "opaque") {
            const copy = res.clone();
            caches.open(CACHE_VERSION).then((c) => c.put(request, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});

// Service worker di Scrivia — guscio offline.
// Strategia: network-first per le pagine (così le vedi sempre fresche quando c'è
// rete), cache-first per gli asset statici. Lo stato delle storie vive comunque
// in locale (localStorage), quindi la prima fase resta consultabile offline —
// utile perché può durare settimane.

const CACHE = "scrivia-v1";
const SHELL = ["/", "/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  const isAsset = url.pathname.startsWith("/_next/") || url.pathname.startsWith("/icons/");
  if (isAsset) {
    e.respondWith(caches.match(req).then((hit) => hit || fetchAndCache(req)));
    return;
  }
  // pagine e dati: network-first con fallback alla cache
  e.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit || caches.match("/")))
  );
});

function fetchAndCache(req) {
  return fetch(req).then((res) => {
    const copy = res.clone();
    caches.open(CACHE).then((c) => c.put(req, copy));
    return res;
  });
}

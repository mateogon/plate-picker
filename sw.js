// Service Worker simple: cache-first para assets, network-first fallback.
const CACHE_NAME = "plate-picker-v1";
const ASSETS = [
  "./",
  "./index.html",
  "./combos.json",
  "./site.webmanifest",
  "./assets/css/styles.css",
  "./assets/js/app.js",
  "./assets/js/state.js",
  "./assets/js/data.js",
  "./assets/js/search.js",
  "./assets/js/render.js",
  "./assets/js/utils.js"
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  // Cache-first para nuestros assets listados
  if (ASSETS.some((a) => url.pathname.endsWith(a.replace("./", "/")))) {
    e.respondWith(
      caches.match(e.request).then((res) => res || fetch(e.request).then((net) => {
        const copy = net.clone();
        caches.open(CACHE_NAME).then((c) => c.put(e.request, copy));
        return net;
      }))
    );
    return;
  }
  // Network-first con fallback a caché
  e.respondWith(
    fetch(e.request).then((net) => {
      const copy = net.clone();
      caches.open(CACHE_NAME).then((c) => c.put(e.request, copy));
      return net;
    }).catch(() => caches.match(e.request))
  );
});

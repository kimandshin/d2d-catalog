const CACHE_NAME = "d2d-rep-v1";
const APP_SHELL = [
  "/d2d-catalog/rep.html",
  "/d2d-catalog/style.css"
];

// Install: precache basic shell
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_NAME)
          .map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// Fetch: app shell = cache-first, API = network-first with cache fallback
self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);

  // Our GitHub pages (HTML/CSS/JS)
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(resp => {
          const copy = resp.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
          return resp;
        });
      })
    );
    return;
  }

  // Apps Script API
  if (url.origin === "https://script.google.com") {
    event.respondWith(
      fetch(event.request)
        .then(resp => {
          const copy = resp.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
          return resp;
        })
        .catch(() => caches.match(event.request))
    );
  }
});

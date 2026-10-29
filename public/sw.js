const CACHE_NAME = 'machine-facturas-static-v1';
const OFFLINE_URL = '/offline';
const STATIC_ASSETS = ['/', '/offline', '/manifest.json', '/logo.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Never cache sensitive/private endpoints.
const NO_CACHE_PATTERNS = [
  /\/api\/auth/,
  /\/api\/invoices/,
  /\/api\/payments/,
  /\/api\/customers/,
  /\/api\/empresa/,
  /\/api\/admin/,
  /\/api\/documents/,
];

function isNoCache(url) {
  return NO_CACHE_PATTERNS.some((re) => re.test(url.pathname));
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Only handle same-origin GET requests.
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;

  // Never cache sensitive endpoints: pass through.
  if (isNoCache(url)) {
    event.respondWith(fetch(req));
    return;
  }

  // Navigation requests: network-first with offline fallback.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(() => caches.match(OFFLINE_URL).then((r) => r || caches.match('/')))
    );
    return;
  }

  // Static assets: cache-first.
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (res && res.status === 200 && res.type === 'basic') {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
        }
        return res;
      }).catch(() => caches.match(OFFLINE_URL));
    })
  );
});

// Offline support for the TEST dashboard. Scope is this folder only.
// The page itself is cached; inventory data lives in the browser's own storage, never here.
const CACHE = 'drh-inv-test-v1';
const ASSETS = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('drh-inv-test-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function timeout(ms) {
  return new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms));
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    // Fresh page when there's signal; cached page when there isn't (or it's crawling).
    e.respondWith((async () => {
      const cached = await caches.match('./index.html');
      const net = fetch(req).then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put('./index.html', copy));
        }
        return res;
      });
      try {
        return cached ? await Promise.race([net, timeout(3500)]) : await net;
      } catch (err) {
        return cached || Response.error();
      }
    })());
    return;
  }

  e.respondWith(caches.match(req).then((hit) => hit || fetch(req)));
});

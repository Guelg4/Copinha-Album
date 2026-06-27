const CACHE = 'album-copinha-v1';
const STATIC = ['/', '/index.html', '/style.css', '/app.js', '/firebase-config.js', '/manifest.json'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(STATIC)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (url.hostname.includes('firebase') || url.hostname.includes('googleapis')) {
    e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
    return;
  }
  e.respondWith(caches.match(e.request).then(c => c || fetch(e.request).then(r => {
    if (!r || r.status !== 200) return r;
    const clone = r.clone();
    caches.open(CACHE).then(cache => cache.put(e.request, clone));
    return r;
  }).catch(() => e.request.mode === 'navigate' ? caches.match('/index.html') : undefined)));
});

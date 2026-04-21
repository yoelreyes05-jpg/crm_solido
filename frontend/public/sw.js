const CACHE_NAME = 'solido-v1';
const ASSETS = [
  '/cliente',
  '/logo-192x192.png',
  '/logo-512x512.png',
  '/logo.png',
];

// Instalar y cachear assets
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// Limpiar caches viejos
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ← ESTE ES EL FETCH HANDLER REAL que Chrome exige
self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then(cached => {
      // Sirve desde cache si existe, si no va a la red
      return cached || fetch(e.request).catch(() => caches.match('/cliente'));
    })
  );
});
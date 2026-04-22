// public/sw.js
const CACHE_NAME = 'solido-v2';

// Al instalar, no pre-cacheamos nada — evita errores de URLs que no existen
self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  // Eliminar caches viejos
  e.waitUntil(
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

// Estrategia: Network first, cache como fallback
self.addEventListener('fetch', (e) => {
  // Solo manejar GET requests
  if (e.request.method !== 'GET') return;

  // No interceptar requests a la API
  const url = new URL(e.request.url);
  if (url.pathname.startsWith('/api/') || 
      url.hostname !== self.location.hostname) {
    return;
  }

  e.respondWith(
    fetch(e.request)
      .then(response => {
        // Si la respuesta es válida, guardarla en caché
        if (response && response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(e.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // Sin internet — servir desde caché
        return caches.match(e.request).then(cached => {
          return cached || new Response('Sin conexión', {
            status: 503,
            headers: { 'Content-Type': 'text/plain' }
          });
        });
      })
  );
});
// Bumped to v3 on 2026-04-18 to invalidate any previously-cached PHI bodies
// from the v2 API cache (medications/conditions/documents/timeline/dashboard
// were inadvertently cached as PHI). The activate handler below deletes any
// caches whose name does not match the current version, which clears the
// stale PHI on first visit after the SW updates.
const CACHE_NAME = 'tabula-medica-v3';
const STATIC_ASSETS = [
  '/favicon.png',
  '/manifest.json',
];

const API_CACHE_NAME = 'tabula-medica-api-v3';
// PHI routes are INTENTIONALLY EXCLUDED here. The server pairs this with
// `noStorePhi` middleware (server/lib/middleware/no-store-phi.ts) which sets
// `Cache-Control: no-store` on every PHI response — but the SW intercepts
// fetch BEFORE the browser HTTP cache layer applies those headers, so URL-
// based exclusion is required.
//
// Removed (PHI-bearing, MUST NOT be cached on disk):
//   /api/timeline, /api/dashboard, /api/medications, /api/conditions,
//   /api/documents, /api/health-records/*, and every other route returning
//   patient data. See server/lib/middleware/no-store-phi.ts for the full list.
//
// Currently nothing in the API surface is safely cacheable offline. Adding a
// route here requires sign-off that the response body contains no PHI under
// HIPAA Safe Harbor §164.514(b)(2). When adding, verify the source route is
// NOT listed in noStorePhi.ts's PHI-router catalog.
const CACHEABLE_API_ROUTES = [];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME && name !== API_CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') {
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstWithCache(request, CACHE_NAME));
    return;
  }

  if (url.pathname.startsWith('/api/')) {
    const isCacheableApi = CACHEABLE_API_ROUTES.some(route => 
      url.pathname.startsWith(route)
    );

    if (isCacheableApi) {
      event.respondWith(networkFirstWithCache(request, API_CACHE_NAME));
    }
    return;
  }

  if (request.destination === 'script' || 
      request.destination === 'style' ||
      request.destination === 'image') {
    event.respondWith(cacheFirstWithNetwork(request, CACHE_NAME));
  }
});

async function networkFirstWithCache(request, cacheName) {
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    const cachedResponse = await caches.match(request);
    
    if (cachedResponse) {
      const headers = new Headers(cachedResponse.headers);
      headers.set('X-From-Cache', 'true');
      headers.set('X-Cache-Date', cachedResponse.headers.get('date') || new Date().toISOString());
      
      return new Response(cachedResponse.body, {
        status: cachedResponse.status,
        statusText: cachedResponse.statusText,
        headers,
      });
    }
    
    return new Response(
      JSON.stringify({ error: 'Offline', message: 'No cached data available' }),
      { 
        status: 503, 
        headers: { 'Content-Type': 'application/json' } 
      }
    );
  }
}

async function cacheFirstWithNetwork(request, cacheName) {
  const cachedResponse = await caches.match(request);
  
  if (cachedResponse) {
    fetch(request).then((networkResponse) => {
      if (networkResponse.ok) {
        caches.open(cacheName).then((cache) => {
          cache.put(request, networkResponse);
        });
      }
    }).catch(() => {});
    
    return cachedResponse;
  }
  
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    return new Response('Offline', { status: 503 });
  }
}

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => caches.delete(name))
      );
    });
  }
});

self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    event.waitUntil(doBackgroundSync());
  }
});

async function doBackgroundSync() {
  const clients = await self.clients.matchAll();
  clients.forEach((client) => {
    client.postMessage({ type: 'SYNC_COMPLETE' });
  });
}

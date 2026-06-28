// SERVICE WORKER KILL-SWITCH
// Earlier versions precached the app shell. After the GCIP/root-route fixes, stale
// clients kept being served the OLD cached (blank) build and never updated. This
// self-destructing SW recovers every stuck client: it takes control immediately,
// deletes all caches, unregisters itself, and reloads open windows so the next load
// comes fresh from the network. (A properly-versioned network-first SW can be
// reintroduced later.)

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    try {
      const names = await caches.keys();
      await Promise.all(names.map((name) => caches.delete(name)));
    } catch (e) {
      // ignore
    }
    try {
      await self.registration.unregister();
    } catch (e) {
      // ignore
    }
    try {
      const clients = await self.clients.matchAll({ type: 'window' });
      for (const client of clients) {
        client.navigate(client.url);
      }
    } catch (e) {
      // ignore
    }
  })());
});

// Passthrough: never serve from cache while this SW is briefly active.
self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request).catch(() => new Response('', { status: 504 })));
});

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  // SW DISABLED (kill-switch). The previous caching service worker precached the app
  // shell and stranded users on stale (blank) builds that never updated. Until a
  // properly-versioned network-first SW is reintroduced, we DO NOT register one and
  // we actively unregister any existing SW + clear its caches so every client recovers
  // to fresh network content. /sw.js is now a self-destructing kill-switch too.
  navigator.serviceWorker
    .getRegistrations()
    .then((registrations) => {
      for (const registration of registrations) registration.unregister();
    })
    .catch(() => {});
  if (typeof caches !== 'undefined') {
    caches
      .keys()
      .then((names) => names.forEach((name) => caches.delete(name)))
      .catch(() => {});
  }
}

export function unregisterServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready.then((registration) => {
      registration.unregister();
    });
  }
}

export function clearServiceWorkerCache() {
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_CACHE' });
  }
}

export function skipWaiting() {
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' });
  }
}

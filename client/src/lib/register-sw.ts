export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  const isDev = import.meta.env.DEV || window.location.hostname.includes('.replit.dev');
  if (isDev) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const registration of registrations) {
        registration.unregister();
        console.log('[SW] Unregistered stale service worker in dev mode');
      }
    });
    if (typeof caches !== 'undefined') {
      caches.keys().then((names) => names.forEach((name) => caches.delete(name)));
    }
    return;
  }

  if (window.location.protocol !== 'https:') return;

  window.addEventListener('load', async () => {
    try {
      const swUrl = '/sw.js';
      const registration = await navigator.serviceWorker.register(swUrl, {
        scope: '/',
      });

      console.log('Service Worker registered:', registration.scope);

      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              console.log('New service worker available');
            }
          });
        }
      });

      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.addEventListener('message', (event) => {
          if (event.data && event.data.type === 'SYNC_COMPLETE') {
            window.dispatchEvent(new CustomEvent('sync-complete'));
          }
        });
      }

      await checkForUpdates(registration);
    } catch (error) {
      console.error('Service Worker registration failed:', error);
    }
  });
}

async function checkForUpdates(registration: ServiceWorkerRegistration) {
  try {
    await registration.update();
  } catch (error) {
    console.log('Service Worker update check failed:', error);
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

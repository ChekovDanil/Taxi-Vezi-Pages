const BUILD_ID = 'Bl_0f_aD';
const CACHE_NAME = `taxi-vezi-pages-${BUILD_ID}`;
const APP_SCOPE = '/Taxi-Vezi-Pages/';
const APP_SHELL = [APP_SCOPE, `${APP_SCOPE}manifest.json`, `${APP_SCOPE}pwa-icon.svg`, `${APP_SCOPE}pwa-splash.svg`];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
});

// A new worker must never take control in the middle of a ride. The app asks
// it to activate only after the user confirms the update in a safe state.
self.addEventListener('message', (event) => {
  if (event.data?.type === 'APPLY_UPDATE' && event.data?.confirmed === true) {
    event.waitUntil(self.skipWaiting());
  }
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((keys) => Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)),
      )),
      self.clients.claim(),
    ]),
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) return;

  const isApplicationAsset = requestUrl.pathname.includes('/assets/') ||
    event.request.destination === 'script' ||
    event.request.destination === 'style';

  // Navigation and application bundles must prefer the network so a newly
  // deployed UI is visible immediately instead of waiting for a PWA restart.
  if (event.request.mode === 'navigate' || isApplicationAsset) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200 && response.type === 'basic') {
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, response.clone()));
          }
          return response;
        })
        .catch(() => caches.match(event.request).then((cached) => cached || caches.match(APP_SCOPE))),
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
      if (!response || response.status !== 200 || response.type !== 'basic') return response;
      caches.open(CACHE_NAME).then((cache) => cache.put(event.request, response.clone()));
      return response;
    })),
  );
});

self.addEventListener('push', (event) => {
  let payload = {};
  try { payload = event.data?.json() || {}; }
  catch { payload = { body: event.data?.text() || '' }; }

  const options = {
    body: payload.body || '',
    icon: payload.icon || `${APP_SCOPE}pwa-icon.svg`,
    badge: payload.badge || `${APP_SCOPE}pwa-icon.svg`,
    data: { url: payload.data?.url || payload.url || APP_SCOPE, ...(payload.data || {}) },
    vibrate: [200, 100, 200],
    tag: payload.tag,
    renotify: true,
    requireInteraction: Boolean(payload.requireInteraction),
  };
  event.waitUntil(self.registration.showNotification(payload.title || 'Верста', options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = event.notification.data?.url || APP_SCOPE;
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
    for (const client of clients) {
      if ('navigate' in client) client.navigate(target);
      if ('focus' in client) return client.focus();
    }
    return self.clients.openWindow ? self.clients.openWindow(target) : undefined;
  }));
});

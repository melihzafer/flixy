// Development service worker (no-op/bypass cache)
self.addEventListener('install', () => {
  // biome-ignore lint/suspicious/noConsole: dev log
  console.log('[Flixy Service Worker] Installed in dev mode.');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // biome-ignore lint/suspicious/noConsole: dev log
  console.log('[Flixy Service Worker] Activated in dev mode.');
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', () => {
  // Bypasses caching for development workflow
  return;
});

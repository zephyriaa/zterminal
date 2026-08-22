/*
 * ZTerminal service-worker retirement script.
 *
 * Older releases registered a Vite PWA worker at the origin root. That worker
 * could continue returning an archived terminal shell after the Next route had
 * changed. This intentionally installs once, removes all origin caches, and
 * unregisters itself. It does not intercept market-data or application traffic.
 */
self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.map((name) => caches.delete(name)));
    await self.clients.claim();
    await self.registration.unregister();
  })());
});

// Service worker: receives audio shared from WhatsApp and hands it to the page.
const VERSION = 'v4';
const SHELL = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open('shell-' + VERSION).then(c => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys())
      if (k.startsWith('shell-') && k !== 'shell-' + VERSION) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method === 'POST' && url.pathname.endsWith('/share-target')) {
    e.respondWith((async () => {
      const form = await e.request.formData();
      const file = form.get('audio');
      const cache = await caches.open('shared');
      if (file && file.size) {
        await cache.put('shared-audio', new Response(file, {
          headers: {
            'Content-Type': file.type || '',
            'X-File-Name': encodeURIComponent(file.name || 'audio')
          }
        }));
      }
      return Response.redirect('./?shared=1', 303);
    })());
    return;
  }
  if (e.request.method === 'GET' && url.origin === location.origin) {
    e.respondWith(
      fetch(e.request).catch(() => caches.match(e.request, { ignoreSearch: true }))
    );
  }
});

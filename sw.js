// Service worker: receives audio shared from WhatsApp and hands it to the page.
const VERSION = 'v16';
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
      const files = form.getAll('audio').filter(f => f && f.size);   // one or several voice messages
      const cache = await caches.open('shared');
      for (const k of await cache.keys()) await cache.delete(k);       // leftovers from an earlier share
      let i = 0;
      for (const file of files) {
        await cache.put(`shared-audio-${i++}`, new Response(file, {
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
  // App files: answer instantly from the phone's cache, refresh the cache in the background.
  // (A new version uploaded to GitHub shows up from the next launch.)
  if (e.request.method === 'GET' && url.origin === location.origin) {
    e.respondWith((async () => {
      const cache = await caches.open('shell-' + VERSION);
      const cached = await cache.match(e.request, { ignoreSearch: true });
      const fresh = fetch(e.request).then(r => {
        if (r.ok) cache.put(e.request.url.split('?')[0], r.clone());
        return r;
      }).catch(() => null);
      if (cached) { e.waitUntil(fresh); return cached; }
      return (await fresh) || new Response('offline', { status: 503 });
    })());
  }
});

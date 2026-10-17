/* Работа без интернета: приложение и рисунки берутся из кэша телефона, а свежая
   версия тихо докачивается в фоне и включается при следующем открытии.
   При каждой публикации новой версии меняй номер в CACHE. */
const CACHE = 'dnevnik-v5';
const SHELL = ['./', 'index.html', 'app.js', 'exercises.js', 'manifest.webmanifest', 'icon-180.png', 'icon-192.png', 'icon-512.png'];
const IMAGES = ["ex/0003-1.jpg","ex/0003-2.jpg","ex/0004-1.svg","ex/0004-2.svg","ex/0006-1.jpg","ex/0006-2.jpg","ex/0010-1.jpg","ex/0010-2.jpg","ex/0012-1.jpg","ex/0012-2.jpg","ex/0014-1.svg","ex/0014-2.svg","ex/0018-1.svg","ex/0018-2.svg","ex/0021-1.svg","ex/0021-2.svg","ex/0025-1.svg","ex/0025-2.svg","ex/0028-1.svg","ex/0028-2.svg","ex/0029-1.svg","ex/0029-2.svg","ex/0030-1.svg","ex/0030-2.svg","ex/0032-1.svg","ex/0032-2.svg","ex/0042-1.svg","ex/0042-2.svg","ex/0043-1.svg","ex/0043-2.svg","ex/0046-1.svg","ex/0046-2.svg","ex/0047-1.jpg","ex/0047-2.jpg","ex/0048-1.svg","ex/0048-2.svg","ex/0049-1.svg","ex/0049-2.svg","ex/0054-1.svg","ex/0054-2.svg","ex/0055-1.svg","ex/0055-2.svg","ex/0056-1.svg","ex/0056-2.svg","ex/0061-1.svg","ex/0061-2.svg","ex/0066-1.svg","ex/0066-2.svg","ex/0077-1.svg","ex/0077-2.svg","ex/0087-1.svg","ex/0087-2.svg","ex/0092-1.svg","ex/0092-2.svg","ex/0096-1.svg","ex/0096-2.svg","ex/0097-1.jpg","ex/0097-2.jpg","ex/0099-1.svg","ex/0099-2.svg","ex/0103-1.svg","ex/0103-2.svg","ex/0109-1.svg","ex/0109-2.svg","ex/0113-1.svg","ex/0113-2.svg","ex/0115-1.svg","ex/0115-2.svg","ex/0117-1.svg","ex/0117-2.svg","ex/0118-1.svg","ex/0118-2.svg","ex/0119-1.svg","ex/0119-2.svg","ex/0122-1.svg","ex/0122-2.svg","ex/0123-1.svg","ex/0123-2.svg","ex/0127-1.svg","ex/0127-2.svg","ex/0142-1.svg","ex/0142-2.svg","ex/0156-1.svg","ex/0156-2.svg","ex/0157-1.svg","ex/0157-2.svg","ex/0162-1.svg","ex/0162-2.svg","ex/0183-1.svg","ex/0183-2.svg","ex/0192-1.svg","ex/0192-2.svg","ex/0205-1.svg","ex/0205-2.svg","ex/0206-1.svg","ex/0206-2.svg","ex/0211-1.svg","ex/0211-2.svg","ex/0223-1.svg","ex/0223-2.svg","ex/0224-1.svg","ex/0224-2.svg","ex/0227-1.svg","ex/0227-2.svg","ex/0236-1.svg","ex/0236-2.svg","ex/0239-1.svg","ex/0239-2.svg","ex/0279-1.svg","ex/0279-2.svg","ex/0282-1.svg","ex/0282-2.svg","ex/0288-1.svg","ex/0288-2.svg","ex/0291-1.svg","ex/0291-2.svg"];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(async (c) => {
    await c.addAll(SHELL);
    await Promise.allSettled(IMAGES.map((u) => c.add(u)));
  }).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('dnevnik-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const font = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (url.origin !== self.location.origin && !font) return;
  const key = req.mode === 'navigate' ? 'index.html' : req;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(key, { ignoreSearch: req.mode === 'navigate' });
    const network = fetch(req).then((res) => {
      if (res && !res.redirected && (res.ok || res.type === 'opaque')) cache.put(key, res.clone());
      return res;
    }).catch(() => null);
    if (cached) { e.waitUntil(network); return cached; }
    const res = await network;
    if (res) return res;
    return req.mode === 'navigate' ? (await cache.match('index.html')) || Response.error() : Response.error();
  })());
});

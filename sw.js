/* Service Worker — يتيح عمل "إدارة المال" دون اتصال بالإنترنت بعد أول زيارة.
   لا يرسل أي بيانات؛ يخزن ملفات التطبيق فقط في ذاكرة المتصفح. */
const CACHE = 'money-management-v1';
const ASSETS = ['./', './index.html', './style.css', './script.js', './manifest.json', './assets/icons/icon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Stale-while-revalidate: عرض النسخة المخزنة فورًا وتحديثها في الخلفية
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  const isFont = /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  if (url.origin !== self.location.origin && !isFont) return;

  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(request, { ignoreSearch: url.origin === self.location.origin });
      const network = fetch(request)
        .then((res) => {
          if (res && (res.ok || res.type === 'opaque')) cache.put(request, res.clone());
          return res;
        })
        .catch(() => cached || (request.mode === 'navigate' ? cache.match('./index.html') : undefined));
      return cached || network;
    })
  );
});

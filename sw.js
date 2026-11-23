/* Service Worker — يتيح عمل "إدارة المال" دون اتصال بالإنترنت بعد أول زيارة.
   لا يرسل أي بيانات؛ يخزن ملفات التطبيق فقط في ذاكرة المتصفح. */
const CACHE = 'money-management-v6';
const ASSETS = ['./', './index.html', './style.css', './script.js', './manifest.json', './assets/icons/icon.svg', './assets/icons/apple-touch-icon.png', './assets/icons/icon-192.png', './assets/icons/icon-512.png', './assets/icons/icon-maskable-512.png', './assets/icons/shortcut-add-96.png', './assets/icons/favicon-32.png'];

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

// ملفات التطبيق: الشبكة أولًا (حتى تصل التحديثات فورًا) ثم النسخة المخزنة عند انقطاع الإنترنت.
// الخطوط: النسخة المخزنة أولًا.
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  const isFont = /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  if (url.origin !== self.location.origin && !isFont) return;

  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(request, { ignoreSearch: !isFont });
      if (isFont && cached) return cached;
      try {
        const res = await fetch(request, isFont ? undefined : { cache: 'no-cache' });
        if (res && (res.ok || res.type === 'opaque')) cache.put(request, res.clone());
        return res;
      } catch (e) {
        return cached || (request.mode === 'navigate' ? cache.match('./index.html') : Response.error());
      }
    })
  );
});

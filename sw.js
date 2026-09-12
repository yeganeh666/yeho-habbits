const CACHE_NAME = 'habits-cache-v1';

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(['/', '/index.html', '/manifest.json']))
  );
});

self.addEventListener('fetch', (e) => {
  // اگر درخواست به گوگل‌اسکریپت باشد، کش نشود و مستقیم ارسال شود
  if (e.request.url.includes('script.google.com')) {
    e.respondWith(fetch(e.request));
    return;
  }
  e.respondWith(
    caches.match(e.request).then((res) => res || fetch(e.request))
  );
});
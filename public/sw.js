// سرویس‌ورکر: پوستهٔ اپ برای باز شدن آفلاین؛ داده‌ها (Supabase / API) هرگز کش نمی‌شوند.
const VERSION = "v1";
const STATIC = `static-${VERSION}`;
const PAGES = `pages-${VERSION}`;

self.addEventListener("install", (e) => { self.skipWaiting(); });
self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (![STATIC, PAGES].includes(k)) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (e) => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin || url.pathname.startsWith("/api/")) return;

  // فایل‌های ثابت (hash دارند): اول کش
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    e.respondWith(caches.open(STATIC).then(async (c) => {
      const hit = await c.match(req); if (hit) return hit;
      const res = await fetch(req); if (res.ok) c.put(req, res.clone()); return res;
    }));
    return;
  }
  // صفحه‌ها: اول شبکه، اگر نبود آخرین نسخهٔ کش‌شده
  if (req.mode === "navigate") {
    e.respondWith((async () => {
      try {
        const res = await fetch(req);
        if (res.ok && !res.redirected) (await caches.open(PAGES)).put(req, res.clone());
        return res;
      } catch {
        return (await caches.match(req)) || (await caches.match("/")) || new Response("آفلاین هستید و این صفحه هنوز ذخیره نشده است.", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
      }
    })());
  }
});

// کلیک روی اعلان: پنجرهٔ باز اپ را جلو بیاور، وگرنه اپ را باز کن
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || "/";
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of wins) {
      if (new URL(c.url).origin !== self.location.origin) continue;
      await c.focus();
      if (new URL(c.url).pathname !== url && "navigate" in c) { try { await c.navigate(url); } catch {} }
      return;
    }
    await self.clients.openWindow(url);
  })());
});

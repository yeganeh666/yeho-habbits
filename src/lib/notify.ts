/**
 * اعلان سیستم‌عامل برای PWA.
 * - در اندروید (Chrome) سازندهٔ new Notification() در PWA خطا می‌دهد؛ باید از
 *   registration.showNotification در سرویس‌ورکر استفاده کرد.
 * - در iOS اعلان فقط در اپی کار می‌کند که به صفحهٔ اصلی اضافه شده (iOS 16.4+)
 *   و درخواست مجوز باید از یک کلیک کاربر بیاید.
 */

export type NotifyState = "unsupported" | "default" | "granted" | "denied";

export function notifyState(): NotifyState {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission as NotifyState;
}

/** فقط داخل رویداد کلیک صدا بزنید */
export async function requestNotify(): Promise<NotifyState> {
  if (notifyState() === "unsupported") return "unsupported";
  try {
    const p = await Notification.requestPermission();
    return p as NotifyState;
  } catch {
    return notifyState();
  }
}

export async function showNotice(title: string, body: string, url = "/"): Promise<boolean> {
  if (notifyState() !== "granted") return false;
  const options: any = {
    body,
    tag: "pomodoro",
    renotify: true,
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    dir: "rtl",
    lang: "fa",
    vibrate: [200, 100, 200],
    data: { url },
  };
  try {
    const reg = "serviceWorker" in navigator ? await navigator.serviceWorker.getRegistration() : undefined;
    if (reg) { await reg.showNotification(title, options); return true; }
    new Notification(title, options); // حالت توسعه: سرویس‌ورکر ثبت نمی‌شود
    return true;
  } catch {
    return false;
  }
}

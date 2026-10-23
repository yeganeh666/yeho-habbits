import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center p-6 text-center">
      <div className="mb-4 text-5xl font-black text-brand">۴۰۴</div>
      <h1 className="text-xl font-bold">صفحه مورد نظر پیدا نشد</h1>
      <p className="mt-2 text-sm text-mute">صفحه‌ای که دنبالش بودید وجود ندارد یا منتقل شده است.</p>
      <Link href="/" className="mt-6 rounded-2xl bg-brand px-6 py-3 font-bold text-white shadow-card">
        بازگشت به خانه
      </Link>
    </main>
  );
}

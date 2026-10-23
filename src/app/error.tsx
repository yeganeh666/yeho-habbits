"use client";

import { useEffect } from "react";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center p-6 text-center">
      <div className="mb-4 text-4xl font-extrabold text-[#E5484D]">خطایی رخ داد</div>
      <p className="max-w-xs text-sm text-mute">متأسفانه در پردازش این بخش مشکلی پیش آمد.</p>
      <button
        onClick={() => reset()}
        className="mt-6 rounded-2xl bg-brand px-6 py-3 font-bold text-white shadow-card"
      >
        تلاش مجدد
      </button>
    </main>
  );
}

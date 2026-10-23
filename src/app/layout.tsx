import type { Metadata, Viewport } from "next";
import "./globals.css";
import { PwaRegister } from "@/components/pwa";

export const metadata: Metadata = {
  title: "عادت‌ها",
  description: "ردیاب عادت و کارهای روزانه با اتصال به تقویم گوگل و پایگاه داده",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "عادت‌ها", statusBarStyle: "black-translucent" },
  icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-touch-icon.png" },
};
export const viewport: Viewport = {
  width: "device-width", initialScale: 1, viewportFit: "cover",
  themeColor: [{ media: "(prefers-color-scheme: light)", color: "#F3F1FC" }, { media: "(prefers-color-scheme: dark)", color: "#0F0D1C" }],
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fa" dir="rtl">
      <body className="min-h-dvh antialiased">{children}<PwaRegister /></body>
    </html>
  );
}

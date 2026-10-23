import { BottomNav, Toaster } from "@/components/ui";
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 pt-[calc(env(safe-area-inset-top)+16px)] safe-b">
      {children}
      <BottomNav />
      <Toaster />
    </div>
  );
}

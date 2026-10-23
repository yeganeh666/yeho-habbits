import { BottomNav, Toaster } from "@/components/ui";
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-md px-3 sm:px-4 pt-[calc(env(safe-area-inset-top)+12px)] safe-b">
      {children}
      <BottomNav />
      <Toaster />
    </div>
  );
}

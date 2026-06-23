"use client";

import { useState } from "react";
import {
  AdminLink,
  BottomNav,
  MobileDrawer,
  MobileHeader,
  Sidebar,
} from "./Navigation";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-[#f5f1eb]">
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      <div className="hidden md:block lg:hidden">
        <Sidebar compact />
      </div>

      <div className="flex min-h-screen flex-1 flex-col">
        <MobileHeader onOpenMenu={() => setMenuOpen(true)} />
        <MobileDrawer open={menuOpen} onClose={() => setMenuOpen(false)} />

        <div className="hidden items-center justify-end border-b border-stone-200/80 bg-[#faf8f5]/80 px-6 py-3 backdrop-blur md:flex lg:flex">
          <AdminLink />
        </div>

        <main className="flex-1 overflow-y-auto px-4 py-6 pb-24 md:px-8 md:pb-8 lg:px-10">
          {children}
        </main>

        <BottomNav />
      </div>
    </div>
  );
}

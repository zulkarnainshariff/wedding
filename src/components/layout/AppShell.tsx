"use client";

import { useState } from "react";
import {
  BottomNav,
  MobileDrawer,
  MobileHeader,
  Sidebar,
} from "./Navigation";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <div className="hidden h-full shrink-0 lg:block">
        <Sidebar />
      </div>

      <div className="hidden h-full shrink-0 md:block lg:hidden">
        <Sidebar compact />
      </div>

      <div className="flex h-full min-w-0 flex-1 flex-col">
        <MobileHeader onOpenMenu={() => setMenuOpen(true)} />
        <MobileDrawer open={menuOpen} onClose={() => setMenuOpen(false)} />

        <main className="flex min-h-0 flex-1 flex-col overflow-hidden px-4 py-6 pb-24 md:px-8 md:pb-8 lg:px-10">
          {children}
        </main>

        <BottomNav />
      </div>
    </div>
  );
}

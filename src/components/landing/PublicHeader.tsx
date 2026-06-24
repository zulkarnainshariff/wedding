"use client";

import Link from "next/link";
import { useState } from "react";
import { LogIn, Map } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { LoginModal } from "@/components/auth/LoginModal";

export function PublicHeader() {
  const { user, loading } = useAuth();
  const [loginOpen, setLoginOpen] = useState(false);

  return (
    <>
      <header className="fixed top-0 right-0 left-0 z-50 flex items-center justify-between px-4 py-4 md:px-8">
        <p className="font-serif text-lg text-[#1e3a5f]/80 md:text-xl">
          Natalie & Zulkarnain
        </p>
        <div className="flex items-center gap-2">
          {!loading && user ? (
            <Link
              href="/itinerary"
              className="inline-flex items-center gap-2 rounded-full border border-[#1e3a5f]/15 bg-white/80 px-4 py-2 text-sm font-medium text-[#1e3a5f] shadow-sm backdrop-blur-sm transition hover:bg-white"
            >
              <Map className="h-4 w-4" />
              <span className="hidden sm:inline">View itinerary</span>
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => setLoginOpen(true)}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#1e3a5f]/15 bg-white/80 text-[#1e3a5f] shadow-sm backdrop-blur-sm transition hover:bg-white"
              aria-label="Sign in"
            >
              <LogIn className="h-5 w-5" />
            </button>
          )}
        </div>
      </header>
      <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} />
    </>
  );
}

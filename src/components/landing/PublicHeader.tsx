"use client";

import Link from "next/link";
import { useState } from "react";
import { CalendarDays, LogIn } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { LoginModal } from "@/components/auth/LoginModal";
import { AppMark } from "@/components/ui/AppMark";

function BrandMark({ linked = false }: { linked?: boolean }) {
  const label = (
    <>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full shadow-sm">
        <AppMark size={36} />
      </span>
      <span>Natalie & Zulkarnain</span>
    </>
  );

  if (linked) {
    return (
      <Link
        href="/"
        className="inline-flex cursor-pointer items-center gap-2.5 font-serif text-lg text-brand-deep/80 transition hover:text-brand-deep md:text-xl"
      >
        {label}
      </Link>
    );
  }

  return (
    <div className="inline-flex items-center gap-2.5 font-serif text-lg text-brand-deep/80 md:text-xl">
      {label}
    </div>
  );
}

export function PublicHeader() {
  const { user, loading } = useAuth();
  const [loginOpen, setLoginOpen] = useState(false);

  return (
    <>
      <header className="flex items-center justify-between px-4 py-4 md:px-8">
        {!loading && user ? <BrandMark /> : <BrandMark linked />}
        <div className="flex items-center gap-2">
          {!loading && user ? (
            <Link
              href="/itinerary"
              className="inline-flex items-center gap-2 rounded-full border border-brand/20 bg-surface/85 px-4 py-2 text-sm font-medium text-brand-deep shadow-sm backdrop-blur-sm transition hover:bg-accent-pearl/50"
            >
              <CalendarDays className="h-4 w-4" aria-hidden />
              <span className="hidden sm:inline">Itinerary</span>
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => setLoginOpen(true)}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-brand/20 bg-surface/85 text-brand-deep shadow-sm backdrop-blur-sm transition hover:bg-accent-pearl/50"
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

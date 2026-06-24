"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { CalendarDays } from "lucide-react";
import { PasswordInput } from "@/components/ui/PasswordInput";

type LoginFormProps = {
  variant?: "page" | "modal";
  onSuccess?: () => void;
  redirectTo?: string;
};

export function LoginForm({
  variant = "page",
  onSuccess,
  redirectTo = "/itinerary",
}: LoginFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setError(data.error ?? "Login failed");
        return;
      }

      onSuccess?.();
      const destination =
        variant === "page"
          ? searchParams.get("next") || redirectTo
          : redirectTo;
      router.push(destination);
      router.refresh();
    } catch {
      setError("Unable to sign in. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  const form = (
    <form onSubmit={handleSubmit} className="space-y-4">
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-stone-600">
          Username
        </span>
        <input
          type="text"
          autoComplete="username"
          autoFocus={variant === "modal"}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="w-full rounded-xl border border-stone-200 px-4 py-3 text-stone-800 outline-none focus:border-[#1e3a5f]/40 focus:ring-2 focus:ring-[#1e3a5f]/10"
          required
        />
      </label>

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-stone-600">
          Password
        </span>
        <PasswordInput
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
          required
          className="w-full rounded-xl border border-stone-200 px-4 py-3 pr-11"
        />
      </label>

      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-xl bg-[#1e3a5f] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#162d4a] disabled:opacity-60"
      >
        {loading ? "Signing in…" : "Sign in"}
      </button>

      {variant === "page" && (
        <p className="text-center text-xs text-stone-400">
          Your session stays signed in on this device until you log out.
        </p>
      )}
    </form>
  );

  if (variant === "modal") {
    return (
      <div>
        <div className="mb-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#1e3a5f] text-[#d4a853]">
            <CalendarDays className="h-6 w-6" />
          </div>
          <h2 className="mt-3 font-serif text-2xl text-[#1e3a5f]">Sign in</h2>
          <p className="mt-1 text-sm text-stone-500">
            Access the family travel itinerary
          </p>
        </div>
        {form}
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f5f1eb] px-4">
      <div className="w-full max-w-md overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-lg">
        <div className="border-b border-stone-100 bg-gradient-to-r from-[#faf8f5] to-white px-8 py-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#1e3a5f] text-[#d4a853]">
            <CalendarDays className="h-7 w-7" />
          </div>
          <h1 className="mt-4 font-serif text-3xl text-[#1e3a5f]">
            Wedding Itinerary
          </h1>
          <p className="mt-2 text-sm text-stone-500">
            Sign in to view the family travel schedule
          </p>
        </div>
        <div className="px-8 py-8">{form}</div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";

const HEARTBEAT_MS = 5 * 60 * 1000;

export function ActivityTracker() {
  const pathname = usePathname();
  const { user } = useAuth();
  const lastPath = useRef<string | null>(null);

  useEffect(() => {
    if (!user || pathname === "/login") return;

    const detailed =
      process.env.NODE_ENV === "development" &&
      pathname !== lastPath.current;

    lastPath.current = pathname;

    void fetch("/api/activity/heartbeat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: pathname, detailed }),
    });
  }, [pathname, user]);

  useEffect(() => {
    if (!user) return;

    const interval = window.setInterval(() => {
      void fetch("/api/activity/heartbeat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: window.location.pathname, detailed: false }),
      });
    }, HEARTBEAT_MS);

    return () => window.clearInterval(interval);
  }, [user]);

  return null;
}

"use client";

import { useState } from "react";
import { Code2 } from "lucide-react";
import { DevModeModal } from "@/components/itinerary/DevModeModal";
import { useTripTime } from "@/components/itinerary/TripTimeContext";
import { useAuth } from "@/components/auth/AuthProvider";

export function DevModePanel({ compact = false }: { compact?: boolean }) {
  const { isAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  const { devMode } = useTripTime();

  if (!isAdmin) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={[
          "flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
          devMode
            ? "bg-amber-100 text-amber-900 hover:bg-amber-200/80"
            : "text-stone-600 hover:bg-stone-100",
          compact ? "justify-center px-2" : "",
        ].join(" ")}
        title={compact ? "Dev mode" : undefined}
      >
        <Code2
          className={[
            "h-5 w-5 shrink-0",
            devMode ? "text-amber-700" : "text-stone-400",
          ].join(" ")}
        />
        {!compact && (
          <span className="flex items-center gap-2">
            Dev mode
            {devMode && (
              <span className="rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-semibold uppercase">
                On
              </span>
            )}
          </span>
        )}
      </button>
      <DevModeModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}

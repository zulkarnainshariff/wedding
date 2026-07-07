"use client";

import type { ReactNode } from "react";
import { formatTripDayCircleBadge } from "@/lib/display-format";

export function DayBannerHeader({
  dayNumber,
  date,
  title,
  isToday,
  trailing,
}: {
  dayNumber: number | null;
  date: string;
  title: string;
  isToday: boolean;
  trailing?: ReactNode;
}) {
  const { day, month } = formatTripDayCircleBadge(date);

  return (
    <div
      className={[
        "sticky top-0 z-20 -mt-px mb-3 flex items-center gap-3 border-b border-border/60 py-2",
        isToday
          ? "rounded-b-2xl border-x border-accent/40 border-t-0 bg-surface-soft px-3 shadow-sm"
          : "bg-background px-0 shadow-sm",
      ].join(" ")}
    >
      <div
        className={[
          "flex h-12 w-12 shrink-0 flex-col items-center justify-center gap-0 rounded-full font-bold leading-none",
          isToday
            ? "bg-accent text-brand-deep ring-2 ring-accent/40 ring-offset-2"
            : "bg-brand-deep text-accent",
        ].join(" ")}
      >
        <span className="text-xl leading-none">{day}</span>
        <span className="-mt-0.5 text-[10px] font-semibold tracking-wide uppercase leading-none">
          {month}
        </span>
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-serif text-xl font-bold text-brand-deep">{title}</h2>
          {isToday ? (
            <span className="rounded-full bg-brand-deep px-2 py-0.5 text-[10px] font-semibold tracking-wide text-accent uppercase">
              Today
            </span>
          ) : null}
          {trailing}
        </div>
        <p className="text-sm font-medium text-accent">
          {dayNumber === null ? (
            <span className="font-bold tracking-wide">PREPARATION</span>
          ) : (
            <>
              Day <span className="font-bold">{dayNumber}</span>
            </>
          )}
        </p>
      </div>
    </div>
  );
}

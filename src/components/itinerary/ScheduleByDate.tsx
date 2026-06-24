"use client";

import { ItemCard } from "./ItemCard";
import { useTaskIndicators } from "@/components/tasks/useTaskIndicators";
import { ScheduleToolbar } from "./ScheduleToolbar";
import { TripProgressIndicator } from "./TripProgressIndicator";
import { useAuth } from "@/components/auth/AuthProvider";
import { useTripTime } from "@/components/itinerary/TripTimeContext";
import { PageShell } from "@/components/layout/PageShell";
import { getDayDisplayTitle, hasRestrictedTravellerView } from "@/lib/day-display";
import { filterPastDays, isDayToday } from "@/lib/trip-time";
import { formatDate } from "@/lib/types";
import type { ItineraryDay, ItineraryItem } from "@/lib/schema";

type DayWithItems = ItineraryDay & { items: ItineraryItem[] };

export function ScheduleByDate({ days }: { days: DayWithItems[] }) {
  const { user } = useAuth();
  const { effectiveDate, hidePast } = useTripTime();
  const restrictedView = hasRestrictedTravellerView(user);

  const daysWithContent = days.filter(
    (day) => day.items.length > 0 || day.title,
  );
  const visibleDays = filterPastDays(daysWithContent, effectiveDate, hidePast);
  const { itemSummaries } = useTaskIndicators();

  return (
    <PageShell
      eyebrow="Category"
      title="Daily Schedule"
      toolbar={<ScheduleToolbar />}
    >
      <TripProgressIndicator days={daysWithContent} />

      {visibleDays.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-stone-300 bg-white/60 p-10 text-center text-stone-500">
          {hidePast
            ? "No upcoming schedule days to show."
            : "No schedule items yet."}
        </div>
      ) : (
        <div className="relative space-y-10">
          {visibleDays.map((day) => {
            const isToday = isDayToday(day.date, effectiveDate);
            const dayTitle = getDayDisplayTitle(day, day.items.length, restrictedView);

            return (
              <section key={day.id} id={`schedule-${day.date}`}>
                <div
                  className={[
                    "sticky top-0 z-10 mb-4 flex items-center gap-3 py-2 backdrop-blur",
                    isToday
                      ? "rounded-2xl border border-[#d4a853]/40 bg-[#faf8f5]/95 px-3"
                      : "bg-[#f5f1eb]/95",
                  ].join(" ")}
                >
                  <div
                    className={[
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold",
                      isToday
                        ? "bg-[#d4a853] text-[#1e3a5f] ring-2 ring-[#d4a853]/40 ring-offset-2"
                        : "bg-[#1e3a5f] text-[#d4a853]",
                    ].join(" ")}
                  >
                    {day.dayNumber}
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-serif text-xl text-[#1e3a5f]">
                        {dayTitle}
                      </h2>
                      {isToday && (
                        <span className="rounded-full bg-[#1e3a5f] px-2 py-0.5 text-[10px] font-semibold tracking-wide text-[#d4a853] uppercase">
                          Today
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-medium text-[#d4a853]">
                      {formatDate(day.date)}
                    </p>
                  </div>
                </div>

                {day.items.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-stone-200 bg-white/50 px-4 py-6 text-sm text-stone-400">
                    Nothing scheduled for this date.
                  </p>
                ) : (
                  <div className="relative space-y-3 pl-5 before:absolute before:top-2 before:bottom-2 before:left-[7px] before:w-px before:bg-[#d4a853]/40">
                    {day.items.map((item) => (
                      <div key={item.id} className="relative">
                        <span
                          className={[
                            "absolute top-6 -left-5 h-2.5 w-2.5 rounded-full border-2 border-white",
                            isToday ? "bg-[#1e3a5f]" : "bg-[#d4a853]",
                          ].join(" ")}
                        />
                        <ItemCard item={item} taskSummary={itemSummaries[item.id]} />
                      </div>
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </PageShell>
  );
}

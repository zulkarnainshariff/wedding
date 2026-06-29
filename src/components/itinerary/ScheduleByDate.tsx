"use client";

import { useMemo, useState } from "react";
import { ItemCard } from "./ItemCard";
import { useTaskIndicators } from "@/components/tasks/useTaskIndicators";
import { ScheduleToolbar } from "./ScheduleToolbar";
import { TripProgressIndicator } from "./TripProgressIndicator";
import { useAuth } from "@/components/auth/AuthProvider";
import { useTripTime } from "@/components/itinerary/TripTimeContext";
import { PageShell } from "@/components/layout/PageShell";
import { getDayDisplayTitle, hasRestrictedTravellerView } from "@/lib/day-display";
import {
  collectScheduleParticipantOptions,
  filterScheduleItemsByParticipants,
} from "@/lib/schedule-participant-filter";
import { useDisplayFormat } from "@/hooks/useDisplayFormat";
import { filterPastDays, isDayToday } from "@/lib/trip-time";
import type { ItineraryDay, ItineraryItem } from "@/lib/schema";

type DayWithItems = ItineraryDay & { items: ItineraryItem[] };

export function ScheduleByDate({ days }: { days: DayWithItems[] }) {
  const { user } = useAuth();
  const { effectiveDate, hidePast } = useTripTime();
  const restrictedView = hasRestrictedTravellerView(user);
  const { formatDateOnly } = useDisplayFormat();
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);

  const allItems = useMemo(
    () => days.flatMap((day) => day.items),
    [days],
  );
  const participantOptions = useMemo(
    () => collectScheduleParticipantOptions(allItems, user),
    [allItems, user],
  );

  const filteredDays = useMemo(
    () =>
      days.map((day) => ({
        ...day,
        items: filterScheduleItemsByParticipants(day.items, selectedParticipants),
      })),
    [days, selectedParticipants],
  );

  const daysWithContent = filteredDays.filter(
    (day) => day.items.length > 0 || day.title,
  );
  const visibleDays = filterPastDays(daysWithContent, effectiveDate, hidePast);
  const { itemSummaries } = useTaskIndicators();

  return (
    <PageShell
      eyebrow="Category"
      title="Daily Schedule"
      toolbar={
        <ScheduleToolbar
          participantOptions={participantOptions}
          selectedParticipants={selectedParticipants}
          onParticipantsChange={setSelectedParticipants}
          jumpDays={visibleDays}
          jumpVariant="schedule"
        />
      }
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
              <section
                key={day.id}
                id={`schedule-${day.date}`}
                className="scroll-mt-24"
              >
                <div
                  className={[
                    "sticky top-0 z-10 mb-4 flex items-center gap-3 py-2 backdrop-blur",
                    isToday
                      ? "rounded-2xl border border-accent/40 bg-surface-soft/95 px-3"
                      : "bg-background/95",
                  ].join(" ")}
                >
                  <div
                    className={[
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold",
                      isToday
                        ? "bg-accent text-brand-deep ring-2 ring-accent/40 ring-offset-2"
                        : "bg-brand-deep text-accent",
                    ].join(" ")}
                  >
                    {day.dayNumber}
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-serif text-xl text-brand-deep">
                        {dayTitle}
                      </h2>
                      {isToday && (
                        <span className="rounded-full bg-brand-deep px-2 py-0.5 text-[10px] font-semibold tracking-wide text-accent uppercase">
                          Today
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-medium text-accent">
                      {formatDateOnly(day.date)}
                    </p>
                  </div>
                </div>

                {day.items.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-stone-200 bg-white/50 px-4 py-6 text-sm text-stone-400">
                    Nothing scheduled for this date.
                  </p>
                ) : (
                  <div className="relative space-y-3 pl-5 before:absolute before:top-2 before:bottom-2 before:left-[7px] before:w-px before:bg-accent/40">
                    {day.items.map((item) => (
                      <div key={item.id} className="relative">
                        <span
                          className={[
                            "absolute top-6 -left-5 h-2.5 w-2.5 rounded-full border-2 border-white",
                            isToday ? "bg-brand-deep" : "bg-accent",
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

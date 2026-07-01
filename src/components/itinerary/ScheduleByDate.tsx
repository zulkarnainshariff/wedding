"use client";

import { useMemo, useState } from "react";
import { ItemCard } from "./ItemCard";
import { useTaskIndicators } from "@/components/tasks/useTaskIndicators";
import { useDocumentIndicators } from "@/components/itinerary/useDocumentIndicators";
import { ScheduleToolbar } from "./ScheduleToolbar";
import { TripProgressIndicator } from "./TripProgressIndicator";
import { useFlightSortedDays } from "./FlightDaySortToggle";
import { useAuth } from "@/components/auth/AuthProvider";
import { useTripTime } from "@/components/itinerary/TripTimeContext";
import { useDayVisibility } from "@/hooks/useDayVisibility";
import { PageShell } from "@/components/layout/PageShell";
import { getDayDisplayTitle, hasRestrictedTravellerView } from "@/lib/day-display";
import {
  collectScheduleParticipantOptions,
  filterScheduleItemsByParticipants,
} from "@/lib/schedule-participant-filter";
import { useDisplayFormat } from "@/hooks/useDisplayFormat";
import { itemSectionId } from "@/lib/day-jump";
import { isDayToday } from "@/lib/trip-time";
import type { ItineraryDay, ItineraryItem } from "@/lib/schema";
import type { ItineraryItemWithSubItems } from "@/lib/item-subitem-utils";

type DayWithItems = ItineraryDay & { items: ItineraryItemWithSubItems[] };

export function ScheduleByDate({ days }: { days: DayWithItems[] }) {
  const { user } = useAuth();
  const { effectiveDate, hidePast, hideFreeDays, hideUntouchedDays } = useTripTime();
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

  const { visibleDays } = useDayVisibility(filteredDays);
  const sortedVisibleDays = useFlightSortedDays(visibleDays);
  const { itemSummaries } = useTaskIndicators();
  const documentCounts = useDocumentIndicators();
  const progressItems = useMemo(
    () => sortedVisibleDays.flatMap((day) => day.items),
    [sortedVisibleDays],
  );

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
          sortDays={visibleDays}
        />
      }
    >
      <TripProgressIndicator days={visibleDays} items={progressItems} />

      {visibleDays.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-stone-300 bg-white/60 p-10 text-center text-stone-500">
          {hidePast
            ? "No upcoming schedule days to show."
            : hideFreeDays || hideUntouchedDays
              ? "No schedule days match your Options filters. Turn them off in the toolbar to see more days."
              : "No schedule days to show. Adjust day visibility or add items from Manage."}
        </div>
      ) : (
        <div className="relative space-y-10">
          {sortedVisibleDays.map((day) => {
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
                      <div key={item.id} id={itemSectionId(item.id)} className="relative scroll-mt-24">
                        <span
                          className={[
                            "absolute top-6 -left-5 h-2.5 w-2.5 rounded-full border-2 border-white",
                            isToday ? "bg-brand-deep" : "bg-accent",
                          ].join(" ")}
                        />
                        <ItemCard
                          item={item}
                          taskSummary={itemSummaries[item.id]}
                          documentCount={documentCounts[item.id]}
                        />
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

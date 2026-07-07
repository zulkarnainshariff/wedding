"use client";

import { useMemo } from "react";
import { DayBannerHeader } from "./DayBannerHeader";
import { ItemCard } from "./ItemCard";
import { TripProgressIndicator } from "./TripProgressIndicator";
import { sortDayItems } from "@/lib/day-item-sort";
import { TaskIndicatorBadge, ItemTaskIndicator, useTaskIndicators } from "@/components/tasks/useTaskIndicators";
import { useDocumentIndicators } from "@/components/itinerary/useDocumentIndicators";
import { useAuth } from "@/components/auth/AuthProvider";
import { useTripTime } from "@/components/itinerary/TripTimeContext";
import { useDayVisibility } from "@/hooks/useDayVisibility";
import { getDayDisplayTitle, hasRestrictedTravellerView } from "@/lib/day-display";
import { DayStandaloneTasks } from "./DayStandaloneTasks";
import { itemSectionId } from "@/lib/day-jump";
import { tripDayDisplayNumber } from "@/lib/trip-day-display";
import { isDayToday } from "@/lib/trip-time";
import type { ItineraryDay, ItineraryItem } from "@/lib/schema";
import type { ItineraryItemWithSubItems } from "@/lib/item-subitem-utils";

type DayWithItems = ItineraryDay & { items: ItineraryItemWithSubItems[] };

export function DayTimeline({ days }: { days: DayWithItems[] }) {
  const { user } = useAuth();
  const { effectiveDate, hidePast, hideFreeDays, hideUntouchedDays } = useTripTime();
  const restrictedView = hasRestrictedTravellerView(user);
  const { visibleDays } = useDayVisibility(days);
  const sortedVisibleDays = useMemo(
    () =>
      visibleDays.map((day) => ({
        ...day,
        items: sortDayItems(day.items, day.date),
      })),
    [visibleDays],
  );
  const { dayCounts, dayTasks, itemSummaries } = useTaskIndicators();
  const documentCounts = useDocumentIndicators();
  const progressItems = useMemo(
    () => sortedVisibleDays.flatMap((day) => day.items),
    [sortedVisibleDays],
  );

  if (visibleDays.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-stone-300 bg-white/60 p-10 text-center text-stone-500">
        {hidePast
          ? "No upcoming days to show. Turn off “Hide past days” to see earlier entries."
          : hideFreeDays || hideUntouchedDays
            ? "No days match your Options filters. Turn them off in the toolbar to see more days."
            : "No itinerary days to show. Adjust day visibility or add days from Manage."}
      </div>
    );
  }

  return (
    <>
      <TripProgressIndicator days={visibleDays} items={progressItems} />

      <div className="relative space-y-10">
        {sortedVisibleDays.map((day) => {
          const isToday = isDayToday(day.date, effectiveDate);
          const dayTitle = getDayDisplayTitle(day, day.items.length, restrictedView);
          const displayDayNumber = tripDayDisplayNumber(day, days);
          const standaloneTasks = dayTasks[day.id] ?? [];

          return (
            <section
              key={day.id}
              id={`day-${day.date}`}
              className="scroll-mt-3"
            >
              <DayBannerHeader
                dayNumber={displayDayNumber}
                date={day.date}
                title={dayTitle}
                isToday={isToday}
                trailing={<TaskIndicatorBadge count={dayCounts[day.id] ?? 0} />}
              />

              {day.notes && (day.items.length > 0 || standaloneTasks.length > 0) && (
                <p className="mb-4 text-sm text-stone-500">{day.notes}</p>
              )}

              {day.items.length === 0 && standaloneTasks.length === 0 ? (
                <p className="rounded-xl border border-dashed border-stone-200 bg-white/50 px-4 py-6 text-sm text-stone-400">
                  No items scheduled for this day.
                </p>
              ) : (
                <div className="space-y-3">
                  <DayStandaloneTasks tasks={standaloneTasks} />
                  {day.items.length > 0 ? (
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
                        itemSummaries={itemSummaries}
                      />
                    </div>
                  ))}
                </div>
                  ) : null}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </>
  );
}

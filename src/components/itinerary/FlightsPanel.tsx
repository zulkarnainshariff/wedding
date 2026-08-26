"use client";

import { useMemo } from "react";
import { ItemCard } from "@/components/itinerary/ItemCard";
import { ScheduleToolbar } from "@/components/itinerary/ScheduleToolbar";
import { useTaskIndicators } from "@/components/tasks/useTaskIndicators";
import { useDocumentIndicators } from "@/components/itinerary/useDocumentIndicators";
import { useTripTime } from "@/components/itinerary/TripTimeContext";
import { PageShell } from "@/components/layout/PageShell";
import { filterPastItems } from "@/lib/trip-time";
import type { ItineraryItem } from "@/lib/schema";

export function FlightsPanel({
  passengerItems,
}: {
  passengerItems: ItineraryItem[];
}) {
  const { effectiveDate, hidePast } = useTripTime();
  const { itemSummaries } = useTaskIndicators();
  const documentCounts = useDocumentIndicators();
  const visibleItems = useMemo(
    () => filterPastItems(passengerItems, effectiveDate, hidePast),
    [passengerItems, effectiveDate, hidePast],
  );

  return (
    <PageShell
      eyebrow="Category"
      title="Flights"
      toolbar={<ScheduleToolbar showDayFilterOptions={false} />}
    >
      {visibleItems.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-stone-300 bg-white/60 p-10 text-center text-stone-500">
          No upcoming flight items to show.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
          {visibleItems.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              taskSummary={itemSummaries[item.id]}
              documentCount={documentCounts[item.id]}
              itemSummaries={itemSummaries}
            />
          ))}
        </div>
      )}
    </PageShell>
  );
}

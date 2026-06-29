"use client";

import { DayTimeline } from "@/components/itinerary/DayTimeline";
import { ScheduleToolbar } from "@/components/itinerary/ScheduleToolbar";
import { PageShell } from "@/components/layout/PageShell";
import { useTripTime } from "@/components/itinerary/TripTimeContext";
import { filterPastDays } from "@/lib/trip-time";
import type { ItineraryDay, ItineraryItem } from "@/lib/schema";

type DayWithItems = ItineraryDay & { items: ItineraryItem[] };

export function ItineraryViewAll({ days }: { days: DayWithItems[] }) {
  const { effectiveDate, hidePast } = useTripTime();
  const visibleDays = filterPastDays(days, effectiveDate, hidePast);

  return (
    <PageShell
      eyebrow="Full itinerary"
      title="View All"
      toolbar={
        <ScheduleToolbar jumpDays={visibleDays} jumpVariant="timeline" />
      }
    >
      <DayTimeline days={days} />
    </PageShell>
  );
}

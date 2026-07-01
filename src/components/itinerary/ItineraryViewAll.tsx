"use client";

import { DayTimeline } from "@/components/itinerary/DayTimeline";
import { ScheduleToolbar } from "@/components/itinerary/ScheduleToolbar";
import { PageShell } from "@/components/layout/PageShell";
import { useDayVisibility } from "@/hooks/useDayVisibility";
import type { ItineraryDay, ItineraryItem } from "@/lib/schema";

type DayWithItems = ItineraryDay & { items: ItineraryItem[] };

export function ItineraryViewAll({ days }: { days: DayWithItems[] }) {
  const { visibleDays } = useDayVisibility(days);

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

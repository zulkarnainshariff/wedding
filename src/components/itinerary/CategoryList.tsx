"use client";

import { ItemCard } from "./ItemCard";
import { useTaskIndicators } from "@/components/tasks/useTaskIndicators";
import { ScheduleToolbar } from "./ScheduleToolbar";
import { useTripTime } from "@/components/itinerary/TripTimeContext";
import { PageShell } from "@/components/layout/PageShell";
import { filterPastItems } from "@/lib/trip-time";
import { CATEGORY_META, type Category } from "@/lib/types";
import type { ItineraryItem } from "@/lib/schema";

export function CategoryList({
  category,
  items,
  embedded = false,
}: {
  category: Category;
  items: ItineraryItem[];
  embedded?: boolean;
}) {
  const { effectiveDate, hidePast } = useTripTime();
  const meta = CATEGORY_META[category];
  const showViewToggle =
    category === "flight" ||
    category === "accommodation" ||
    category === "activity";
  const { itemSummaries } = useTaskIndicators();

  const visibleItems = filterPastItems(items, effectiveDate, hidePast);

  const list = (
    <>
      {visibleItems.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-stone-300 bg-white/60 p-10 text-center text-stone-500">
          {hidePast
            ? `No upcoming ${meta.label.toLowerCase()} items to show.`
            : `No ${meta.label.toLowerCase()} items yet.`}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
          {visibleItems.map((item) => (
            <ItemCard key={item.id} item={item} taskSummary={itemSummaries[item.id]} />
          ))}
        </div>
      )}
    </>
  );

  if (embedded) {
    return list;
  }

  return (
    <PageShell
      eyebrow="Category"
      title={meta.plural}
      toolbar={showViewToggle ? <ScheduleToolbar /> : undefined}
    >
      {list}
    </PageShell>
  );
}

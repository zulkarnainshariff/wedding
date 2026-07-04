"use client";

import { ItemCard } from "./ItemCard";
import { useTaskIndicators } from "@/components/tasks/useTaskIndicators";
import { useDocumentIndicators } from "@/components/itinerary/useDocumentIndicators";
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
  const documentCounts = useDocumentIndicators();

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
        <div className="grid min-w-0 max-w-full gap-4 md:grid-cols-2 xl:grid-cols-1">
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
    </>
  );

  if (embedded) {
    return list;
  }

  return (
    <PageShell
      eyebrow="Category"
      title={meta.plural}
      toolbar={
        showViewToggle ? (
          <ScheduleToolbar showDayFilterOptions={false} />
        ) : undefined
      }
    >
      {list}
    </PageShell>
  );
}

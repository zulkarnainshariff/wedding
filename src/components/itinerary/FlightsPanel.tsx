"use client";

import { useMemo, useState } from "react";
import { ItemCard } from "@/components/itinerary/ItemCard";
import { CategoryList } from "@/components/itinerary/CategoryList";
import { ScheduleToolbar } from "@/components/itinerary/ScheduleToolbar";
import { useTaskIndicators } from "@/components/tasks/useTaskIndicators";
import { useTripTime } from "@/components/itinerary/TripTimeContext";
import { PageShell } from "@/components/layout/PageShell";
import { filterPastItems } from "@/lib/trip-time";
import type { ItineraryItem } from "@/lib/schema";
import { useAuth } from "@/components/auth/AuthProvider";
import type { Category } from "@/lib/types";

type FlightTab = "all" | "flight" | "pet_relocation";

const TABS: { id: FlightTab; label: string; category?: Category }[] = [
  { id: "all", label: "All" },
  { id: "flight", label: "Passenger Flights", category: "flight" },
  { id: "pet_relocation", label: "Pet Relocation", category: "pet_relocation" },
];

function FlightTabBar({
  tab,
  visibleTabs,
  onChange,
}: {
  tab: FlightTab;
  visibleTabs: typeof TABS;
  onChange: (tab: FlightTab) => void;
}) {
  return (
    <div className="mb-4 flex flex-wrap gap-2">
      {visibleTabs.map((entry) => (
        <button
          key={entry.id}
          type="button"
          onClick={() => onChange(entry.id)}
          className={[
            "rounded-full px-4 py-1.5 text-sm font-medium",
            tab === entry.id
              ? "bg-brand-deep text-white"
              : "border border-stone-200 text-stone-600 hover:bg-stone-50",
          ].join(" ")}
        >
          {entry.label}
        </button>
      ))}
    </div>
  );
}

export function FlightsPanel({
  passengerItems,
  petItems,
  initialTab = "all",
}: {
  passengerItems: ItineraryItem[];
  petItems: ItineraryItem[];
  initialTab?: FlightTab;
}) {
  const { canView } = useAuth();
  const visibleTabs = TABS.filter(
    (entry) =>
      entry.id === "all" ||
      (entry.category ? canView(entry.category) : false),
  );
  const [tab, setTab] = useState<FlightTab>(
    visibleTabs.some((entry) => entry.id === initialTab)
      ? initialTab
      : visibleTabs[0]?.id ?? "all",
  );

  const items = useMemo(() => {
    if (tab === "flight") return passengerItems;
    if (tab === "pet_relocation") return petItems;
    return [...passengerItems, ...petItems].sort((a, b) => {
      const aTime = a.startDatetime ? new Date(a.startDatetime).getTime() : 0;
      const bTime = b.startDatetime ? new Date(b.startDatetime).getTime() : 0;
      return aTime - bTime || a.sortOrder - b.sortOrder;
    });
  }, [tab, passengerItems, petItems]);

  const displayCategory: Category =
    tab === "pet_relocation" ? "pet_relocation" : "flight";

  const { effectiveDate, hidePast } = useTripTime();
  const { itemSummaries } = useTaskIndicators();
  const visibleItems = filterPastItems(items, effectiveDate, hidePast);

  if (tab === "all") {
    return (
      <PageShell eyebrow="Category" title="Flights" toolbar={<ScheduleToolbar />}>
        <FlightTabBar tab={tab} visibleTabs={visibleTabs} onChange={setTab} />
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
              />
            ))}
          </div>
        )}
      </PageShell>
    );
  }

  return (
    <PageShell eyebrow="Category" title="Flights" toolbar={<ScheduleToolbar />}>
      <FlightTabBar tab={tab} visibleTabs={visibleTabs} onChange={setTab} />
      <CategoryList category={displayCategory} items={items} embedded />
    </PageShell>
  );
}

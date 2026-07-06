"use client";

import { CategoryList } from "@/components/itinerary/CategoryList";
import { TravelInsurancePanel } from "@/components/admin/TravelInsurancePanel";
import { PageShell } from "@/components/layout/PageShell";
import { useAuth } from "@/components/auth/AuthProvider";
import { CATEGORY_META } from "@/lib/types";
import type { ItineraryItem } from "@/lib/schema";

export function TravelInsuranceItinerary({
  items,
  allItems,
}: {
  items: ItineraryItem[];
  allItems: ItineraryItem[];
}) {
  const { canEdit } = useAuth();
  const meta = CATEGORY_META.travel_insurance;

  if (items.length > 0) {
    return <CategoryList category="travel_insurance" items={items} />;
  }

  if (canEdit) {
    return (
      <PageShell eyebrow="Category" title={meta.plural}>
        <TravelInsurancePanel initialItems={allItems} embedded />
      </PageShell>
    );
  }

  return (
    <PageShell eyebrow="Category" title={meta.plural}>
      <div className="rounded-2xl border border-dashed border-stone-300 bg-white/60 p-10 text-center text-stone-500">
        Travel insurance details have not been added yet.
      </div>
    </PageShell>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { CategoryList } from "@/components/itinerary/CategoryList";
import { TravelInsuranceForm } from "@/components/admin/TravelInsuranceForm";
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
  const router = useRouter();
  const { canEdit } = useAuth();
  const meta = CATEGORY_META.travel_insurance;
  const [addingPolicy, setAddingPolicy] = useState(false);

  if (items.length === 0) {
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

  return (
    <PageShell
      eyebrow="Category"
      title={meta.plural}
      toolbar={
        canEdit ? (
          <button
            type="button"
            onClick={() => setAddingPolicy((current) => !current)}
            className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-medium text-brand-deep shadow-sm hover:bg-stone-50"
          >
            <Plus className="h-4 w-4" />
            {addingPolicy ? "Cancel" : "Add policy"}
          </button>
        ) : undefined
      }
    >
      <CategoryList category="travel_insurance" items={items} embedded />
      {canEdit && addingPolicy ? (
        <div className="mt-6">
          <TravelInsuranceForm
            initialItems={allItems}
            onCancel={() => setAddingPolicy(false)}
            onSaved={() => {
              setAddingPolicy(false);
              router.refresh();
            }}
          />
        </div>
      ) : null}
    </PageShell>
  );
}

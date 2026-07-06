"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus } from "lucide-react";
import {
  TravelInsuranceForm,
  travelInsurancePolicySummary,
} from "@/components/admin/TravelInsuranceForm";
import { SectionShell } from "@/components/layout/PageShell";
import type { ItineraryItem } from "@/lib/schema";

type FormMode = "new" | number;

export function TravelInsurancePanel({
  initialItems,
  embedded = false,
}: {
  initialItems: ItineraryItem[];
  embedded?: boolean;
}) {
  const router = useRouter();
  const policies = useMemo(
    () =>
      initialItems
        .filter((item) => item.category === "travel_insurance")
        .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id),
    [initialItems],
  );
  const [formMode, setFormMode] = useState<FormMode | null>(
    policies.length === 0 ? "new" : null,
  );
  const [status, setStatus] = useState<string | null>(null);

  const editingItem =
    typeof formMode === "number"
      ? policies.find((policy) => policy.id === formMode) ?? null
      : null;

  function handleSaved() {
    setStatus("Travel insurance saved.");
    setFormMode(null);
    router.refresh();
  }

  const body = (
    <>
      <p className="mb-4 text-sm text-stone-500">
        Add and manage travel insurance policies. Each policy appears as its own
        card in the itinerary for everyone who can view travel insurance.
      </p>

      {policies.length > 0 ? (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold tracking-wide text-stone-600 uppercase">
            Policies
          </h3>
          <ul className="space-y-2">
            {policies.map((policy) => (
              <li
                key={policy.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-stone-200 bg-stone-50 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-stone-800">
                    {policy.title}
                  </p>
                  <p className="truncate text-sm text-stone-500">
                    {travelInsurancePolicySummary(policy)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setFormMode(policy.id)}
                  className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-sm text-stone-700 hover:bg-stone-100"
                >
                  <Pencil className="h-4 w-4" />
                  Edit
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {formMode === null ? (
        <button
          type="button"
          onClick={() => setFormMode("new")}
          className="mt-4 inline-flex items-center gap-2 rounded-lg border border-brand/20 bg-white px-4 py-2 text-sm font-medium text-brand-deep hover:bg-accent-pearl/40"
        >
          <Plus className="h-4 w-4" />
          Add policy
        </button>
      ) : (
        <div className={policies.length > 0 ? "mt-4" : ""}>
          <TravelInsuranceForm
            initialItems={initialItems}
            item={formMode === "new" ? null : editingItem}
            onCancel={() => setFormMode(null)}
            onSaved={handleSaved}
          />
        </div>
      )}

      {status ? (
        <p className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {status}
        </p>
      ) : null}
    </>
  );

  if (embedded) {
    return body;
  }

  return <SectionShell title="Travel insurance">{body}</SectionShell>;
}

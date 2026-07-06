"use client";

import { useEffect, useState } from "react";
import { Save, X } from "lucide-react";
import { AdminItemDetailsForm } from "@/components/admin/AdminItemDetailsForm";
import {
  buildItemApiPayload,
  emptyItemForm,
  itemToForm,
  type ItemFormState,
} from "@/lib/admin-item-form";
import type { TravelInsuranceDetails } from "@/lib/types";
import type { ItineraryItem } from "@/lib/schema";

export function TravelInsuranceForm({
  initialItems,
  item = null,
  onSaved,
  onCancel,
}: {
  initialItems: ItineraryItem[];
  item?: ItineraryItem | null;
  onSaved: (saved: ItineraryItem) => void;
  onCancel?: () => void;
}) {
  const [itemId, setItemId] = useState<number | null>(item?.id ?? null);
  const [form, setForm] = useState<ItemFormState>(() =>
    item ? itemToForm(item) : emptyItemForm("travel_insurance"),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setItemId(item?.id ?? null);
    setForm(item ? itemToForm(item) : emptyItemForm("travel_insurance"));
    setError(null);
  }, [item]);

  async function save() {
    if (!form.title.trim()) {
      setError("Policy title is required.");
      return;
    }

    setBusy(true);
    setError(null);
    const payload = buildItemApiPayload({
      ...form,
      category: "travel_insurance",
    });

    const response = await fetch(
      itemId ? `/api/items/${itemId}` : "/api/items",
      {
        method: itemId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );

    setBusy(false);
    if (!response.ok) {
      setError("Could not save travel insurance details.");
      return;
    }

    const saved = (await response.json()) as ItineraryItem;
    setItemId(saved.id);
    setForm(itemToForm(saved));
    onSaved(saved);
  }

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-stone-500">
          {itemId
            ? "Update this policy. Changes appear in the itinerary for everyone who can view it."
            : "Add a travel insurance policy. It will appear in the itinerary for everyone who can view travel insurance."}
        </p>
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="shrink-0 rounded-full border border-stone-200 p-1.5 text-stone-500 hover:bg-stone-50"
            aria-label="Cancel"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="block text-sm sm:col-span-2">
          <span className="mb-1 block text-stone-500">Title</span>
          <input
            value={form.title}
            onChange={(event) =>
              setForm((current) => ({ ...current, title: event.target.value }))
            }
            placeholder="Family travel insurance"
            className="w-full rounded-lg border border-stone-200 px-3 py-2"
          />
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className="mb-1 block text-stone-500">Summary</span>
          <input
            value={form.summary}
            onChange={(event) =>
              setForm((current) => ({ ...current, summary: event.target.value }))
            }
            placeholder="Optional short summary"
            className="w-full rounded-lg border border-stone-200 px-3 py-2"
          />
        </label>
      </div>

      <h3 className="mt-6 text-sm font-semibold tracking-wide text-stone-600 uppercase">
        Policy details
      </h3>
      <AdminItemDetailsForm
        category="travel_insurance"
        structured={form.structured}
        allItems={initialItems}
        onChange={(structured) => setForm((current) => ({ ...current, structured }))}
      />

      {error ? (
        <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <button
        type="button"
        disabled={busy}
        onClick={() => void save()}
        className="mt-4 inline-flex items-center gap-2 rounded-lg bg-brand-deep px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        <Save className="h-4 w-4" />
        {itemId ? "Save changes" : "Add policy"}
      </button>
    </div>
  );
}

export function travelInsurancePolicySummary(item: ItineraryItem): string {
  const details = item.details as TravelInsuranceDetails | null;
  const parts = [details?.provider, details?.policyNumber].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : item.summary?.trim() || "Policy";
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import { AdminItemDetailsForm } from "@/components/admin/AdminItemDetailsForm";
import {
  buildItemApiPayload,
  emptyItemForm,
  itemToForm,
  type ItemFormState,
} from "@/lib/admin-item-form";
import { SectionShell } from "@/components/layout/PageShell";
import type { ItineraryItem } from "@/lib/schema";

export function TravelInsurancePanel({
  initialItems,
}: {
  initialItems: ItineraryItem[];
}) {
  const router = useRouter();
  const existing = initialItems.find((item) => item.category === "travel_insurance");
  const [itemId, setItemId] = useState<number | null>(existing?.id ?? null);
  const [form, setForm] = useState<ItemFormState>(() =>
    existing ? itemToForm(existing) : emptyItemForm("travel_insurance"),
  );
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [systemUsernames, setSystemUsernames] = useState<string[]>([]);

  useEffect(() => {
    void fetch("/api/users/brief")
      .then((response) => (response.ok ? response.json() : []))
      .then((rows: { username: string }[]) => {
        setSystemUsernames(rows.map((row) => row.username));
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (existing) {
      setItemId(existing.id);
      setForm(itemToForm(existing));
    }
  }, [existing]);

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

    const saved = await response.json();
    setItemId(saved.id);
    setForm(itemToForm(saved));
    setStatus("Travel insurance details saved.");
    router.refresh();
  }

  return (
    <SectionShell title="Travel insurance">
      <p className="mb-4 text-sm text-stone-500">
        Add or update the family travel insurance policy. This appears in the
        itinerary for everyone who can view travel insurance.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
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
        systemUsernames={systemUsernames}
        onChange={(structured) => setForm((current) => ({ ...current, structured }))}
      />

      {error && (
        <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      {status && (
        <p className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {status}
        </p>
      )}

      <button
        type="button"
        disabled={busy}
        onClick={() => void save()}
        className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#1e3a5f] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        <Save className="h-4 w-4" />
        {itemId ? "Save changes" : "Create travel insurance item"}
      </button>
    </SectionShell>
  );
}

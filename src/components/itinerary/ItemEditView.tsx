"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Save, Trash2, X } from "lucide-react";
import { AdminItemDetailsForm } from "@/components/admin/AdminItemDetailsForm";
import { FlightScheduleTimes } from "@/components/admin/FlightScheduleTimes";
import {
  applyAccommodationStructuredToForm,
  buildItemApiPayload,
  emptyItemForm,
  itemToForm,
  type ItemFormState,
} from "@/lib/admin-item-form";
import { useDisplayFormat } from "@/hooks/useDisplayFormat";
import { CATEGORY_META, CATEGORIES, type Category } from "@/lib/types";
import type { ItineraryDay, ItineraryItem } from "@/lib/schema";

function ItemEditFormFields({
  form,
  setForm,
  days,
  allItems,
}: {
  form: ItemFormState;
  setForm: React.Dispatch<React.SetStateAction<ItemFormState>>;
  days: ItineraryDay[];
  allItems: ItineraryItem[];
}) {
  const { formatDayOption } = useDisplayFormat();

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block text-stone-500">Category</span>
          <select
            value={form.category}
            onChange={(e) => {
              const category = e.target.value as Category;
              setForm({
                ...form,
                category,
                structured: emptyItemForm(category).structured,
              });
            }}
            className="w-full rounded-lg border border-stone-200 px-3 py-2"
          >
            {CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {CATEGORY_META[category].label}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm">
          <span className="mb-1 block text-stone-500">Day</span>
          <select
            value={form.dayId}
            onChange={(e) => setForm({ ...form, dayId: e.target.value })}
            className="w-full rounded-lg border border-stone-200 px-3 py-2"
          >
            <option value="">Unassigned</option>
            {days.map((day) => (
              <option key={day.id} value={day.id}>
                {formatDayOption(day)}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm sm:col-span-2">
          <span className="mb-1 block text-stone-500">Title *</span>
          <input
            required
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="w-full rounded-lg border border-stone-200 px-3 py-2"
          />
        </label>

        <label className="block text-sm sm:col-span-2">
          <span className="mb-1 block text-stone-500">Summary</span>
          <input
            value={form.summary}
            onChange={(e) => setForm({ ...form, summary: e.target.value })}
            className="w-full rounded-lg border border-stone-200 px-3 py-2"
          />
        </label>

        {form.category === "flight" ? (
          <FlightScheduleTimes itemForm={form} setItemForm={setForm} />
        ) : form.category !== "accommodation" ? (
          <>
            <label className="block text-sm">
              <span className="mb-1 block text-stone-500">Start</span>
              <input
                type="datetime-local"
                value={form.startDatetime}
                onChange={(e) =>
                  setForm({ ...form, startDatetime: e.target.value })
                }
                className="w-full rounded-lg border border-stone-200 px-3 py-2"
              />
            </label>

            <label className="block text-sm">
              <span className="mb-1 block text-stone-500">End</span>
              <input
                type="datetime-local"
                value={form.endDatetime}
                onChange={(e) =>
                  setForm({ ...form, endDatetime: e.target.value })
                }
                className="w-full rounded-lg border border-stone-200 px-3 py-2"
              />
            </label>
          </>
        ) : null}
      </div>

      <h3 className="mt-6 text-sm font-semibold tracking-wide text-stone-600 uppercase">
        {CATEGORY_META[form.category].label} details
      </h3>
      <AdminItemDetailsForm
        category={form.category}
        structured={form.structured}
        allItems={allItems}
        onChange={(structured) =>
          setForm((current) =>
            applyAccommodationStructuredToForm(current, structured),
          )
        }
      />
    </>
  );
}

export function ItemEditView({
  item,
  onCancel,
  onSaved,
  onDelete,
  modal = false,
}: {
  item: ItineraryItem;
  onCancel: () => void;
  onSaved: () => void;
  onDelete?: () => void;
  modal?: boolean;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [form, setForm] = useState<ItemFormState>(() => itemToForm(item));
  const [days, setDays] = useState<ItineraryDay[]>([]);
  const [allItems, setAllItems] = useState<ItineraryItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void Promise.all([fetch("/api/days"), fetch("/api/items")]).then(
      async ([daysRes, itemsRes]) => {
        if (daysRes.ok) setDays(await daysRes.json());
        if (itemsRes.ok) setAllItems(await itemsRes.json());
      },
    );
  }, []);

  async function handleSave() {
    if (!form.title.trim()) {
      setError("Title is required.");
      return;
    }

    setSaving(true);
    setError(null);

    const response = await fetch(`/api/items/${item.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildItemApiPayload(form)),
    });

    setSaving(false);

    if (!response.ok) {
      setError("Could not save changes.");
      return;
    }

    startTransition(() => {
      router.refresh();
    });
    onSaved();
  }

  const modalFooter = (
    <div className="flex w-full items-center justify-between gap-3">
      {onDelete ? (
        <button
          type="button"
          onClick={onDelete}
          className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50"
        >
          <Trash2 className="h-4 w-4" />
          Delete
        </button>
      ) : (
        <span />
      )}
      <div className="flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl border border-stone-200 px-4 py-2.5 text-sm text-stone-600"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={saving || !form.title.trim()}
          onClick={() => void handleSave()}
          className="inline-flex items-center gap-2 rounded-xl bg-brand-deep px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          {saving ? "Saving…" : "Save changes"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm font-medium text-stone-600 hover:bg-stone-50"
        >
          <X className="h-4 w-4" />
          Close
        </button>
      </div>
    </div>
  );

  const inlineActions = (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        disabled={saving || !form.title.trim()}
        onClick={() => void handleSave()}
        className="inline-flex items-center gap-2 rounded-xl bg-brand-deep px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
      >
        <Save className="h-4 w-4" />
        {saving ? "Saving…" : "Save changes"}
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="rounded-xl border border-stone-200 px-4 py-2.5 text-sm text-stone-600"
      >
        Cancel
      </button>
      {onDelete && (
        <button
          type="button"
          onClick={onDelete}
          className="inline-flex items-center gap-2 rounded-xl border border-red-200 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50"
        >
          <Trash2 className="h-4 w-4" />
          Delete
        </button>
      )}
    </div>
  );

  if (modal) {
    return (
      <div className="flex max-h-[92vh] flex-col overflow-hidden rounded-t-3xl border border-stone-200 bg-white shadow-xl sm:rounded-3xl">
        <div className="shrink-0 border-b border-stone-100 px-6 py-4 sm:px-8">
          <div className="flex items-center justify-between gap-3 sm:hidden">
            <p className="min-w-0 truncate text-xs font-semibold tracking-[0.2em] text-accent uppercase">
              Edit item
            </p>
            <button
              type="button"
              onClick={onCancel}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-stone-200 bg-white text-stone-500 hover:border-brand-deep/30 hover:text-brand-deep"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="hidden items-start justify-between gap-3 sm:flex">
            <div>
              <p className="text-xs font-semibold tracking-[0.2em] text-accent uppercase">
                Edit item
              </p>
              <h2 className="mt-1 font-serif text-2xl text-brand-deep">{item.title}</h2>
            </div>
            <button
              type="button"
              onClick={onCancel}
              className="rounded-full border border-stone-200 bg-white p-2 text-stone-500 shadow-sm hover:bg-stone-50"
              aria-label="Cancel editing"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <h2 className="mt-1 font-serif text-xl text-brand-deep sm:hidden">{item.title}</h2>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4 sm:px-8">
          <ItemEditFormFields
            form={form}
            setForm={setForm}
            days={days}
            allItems={allItems}
          />
          {error && (
            <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}
        </div>

        <div className="shrink-0 border-t border-stone-100 px-6 py-4 sm:px-8">
          {modalFooter}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
      <div className="mb-6">
        <p className="text-xs font-semibold tracking-[0.2em] text-accent uppercase">
          Edit item
        </p>
        <h2 className="mt-1 font-serif text-2xl text-brand-deep">{item.title}</h2>
      </div>

      <ItemEditFormFields
        form={form}
        setForm={setForm}
        days={days}
        allItems={allItems}
      />

      {error && (
        <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="mt-6">{inlineActions}</div>
    </div>
  );
}

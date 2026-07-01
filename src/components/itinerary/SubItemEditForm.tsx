"use client";

import { useEffect, useMemo, useState } from "react";
import { Save, Trash2, X } from "lucide-react";
import { CheckboxDropdown } from "@/components/admin/CheckboxDropdown";
import { getSubItemFormPlaceholders } from "@/lib/sub-item-placeholders";
import {
  isSubItem,
  subItemToFormState,
  type SubItemFormState,
} from "@/lib/item-subitems";
import { travellerOptions } from "@/lib/admin-item-details";
import type { ItineraryItem } from "@/lib/schema";

const EMPTY_FORM: SubItemFormState = {
  title: "",
  time: "",
  locationName: "",
  locationMapUrl: "",
  summary: "",
  participants: [],
};

function SubItemFormFields({
  form,
  setForm,
  placeholders,
}: {
  form: SubItemFormState;
  setForm: React.Dispatch<React.SetStateAction<SubItemFormState>>;
  placeholders: ReturnType<typeof getSubItemFormPlaceholders>;
}) {
  const participantOptions = useMemo(
    () => travellerOptions(form.participants),
    [form.participants],
  );

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="block text-sm sm:col-span-2">
        <span className="mb-1 block text-stone-500">Title *</span>
        <input
          value={form.title}
          onChange={(e) => setForm((current) => ({ ...current, title: e.target.value }))}
          placeholder={placeholders.title}
          className="w-full rounded-lg border border-stone-200 px-3 py-2"
          required
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-stone-500">Time (optional)</span>
        <input
          type="time"
          value={form.time}
          onChange={(e) => setForm((current) => ({ ...current, time: e.target.value }))}
          className="w-full rounded-lg border border-stone-200 px-3 py-2"
        />
      </label>
      <div className="text-sm sm:col-span-2">
        <CheckboxDropdown
          label="Participants"
          options={participantOptions}
          value={form.participants}
          onChange={(participants) =>
            setForm((current) => ({ ...current, participants }))
          }
          emptyLabel="Select participants…"
        />
      </div>
      <label className="block text-sm">
        <span className="mb-1 block text-stone-500">Location name (optional)</span>
        <input
          value={form.locationName}
          onChange={(e) =>
            setForm((current) => ({ ...current, locationName: e.target.value }))
          }
          placeholder={placeholders.locationName}
          className="w-full rounded-lg border border-stone-200 px-3 py-2"
        />
      </label>
      <label className="block text-sm sm:col-span-2">
        <span className="mb-1 block text-stone-500">Google Maps link (optional)</span>
        <input
          type="url"
          value={form.locationMapUrl}
          onChange={(e) =>
            setForm((current) => ({ ...current, locationMapUrl: e.target.value }))
          }
          placeholder={placeholders.locationMapUrl}
          className="w-full rounded-lg border border-stone-200 px-3 py-2"
        />
      </label>
      <label className="block text-sm sm:col-span-2">
        <span className="mb-1 block text-stone-500">Details (optional)</span>
        <textarea
          value={form.summary}
          onChange={(e) => setForm((current) => ({ ...current, summary: e.target.value }))}
          rows={3}
          className="w-full rounded-lg border border-stone-200 px-3 py-2"
        />
      </label>
    </div>
  );
}

export function SubItemEditForm({
  item,
  parentItem,
  modal = false,
  onCancel,
  onSaved,
  onDelete,
}: {
  item: ItineraryItem;
  parentItem?: ItineraryItem | null;
  modal?: boolean;
  onCancel: () => void;
  onSaved: () => void;
  onDelete?: () => void;
}) {
  const placeholders = getSubItemFormPlaceholders(parentItem ?? item);
  const [form, setForm] = useState<SubItemFormState>(() =>
    isSubItem(item) ? subItemToFormState(item) : EMPTY_FORM,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setForm(isSubItem(item) ? subItemToFormState(item) : EMPTY_FORM);
    setError(null);
  }, [item.id]);

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
      body: JSON.stringify(form),
    });

    setSaving(false);

    if (!response.ok) {
      setError("Could not save sub-item.");
      return;
    }

    onSaved();
  }

  const body = (
    <>
      <SubItemFormFields
        form={form}
        setForm={setForm}
        placeholders={placeholders}
      />
      {error && (
        <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
    </>
  );

  const actions = (
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
        {modal ? (
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm font-medium text-stone-600 hover:bg-stone-50"
          >
            <X className="h-4 w-4" />
            Close
          </button>
        ) : null}
      </div>
    </div>
  );

  if (modal) {
    return (
      <div className="flex max-h-[92vh] flex-col overflow-hidden rounded-t-3xl border border-stone-200 bg-white shadow-xl sm:rounded-3xl">
        <div className="shrink-0 border-b border-stone-100 px-6 py-4 sm:px-8">
          <p className="text-xs font-semibold tracking-[0.2em] text-accent uppercase">
            Edit sub-item
          </p>
          <h2 className="mt-1 font-serif text-2xl text-brand-deep">{item.title}</h2>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4 sm:px-8">{body}</div>
        <div className="shrink-0 border-t border-stone-100 px-6 py-4 sm:px-8">
          {actions}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
      <div className="mb-6">
        <p className="text-xs font-semibold tracking-[0.2em] text-accent uppercase">
          Edit sub-item
        </p>
        <h2 className="mt-1 font-serif text-2xl text-brand-deep">{item.title}</h2>
      </div>
      {body}
      <div className="mt-6">{actions}</div>
    </div>
  );
}

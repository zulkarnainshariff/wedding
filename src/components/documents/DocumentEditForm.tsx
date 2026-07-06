"use client";

import { useState } from "react";
import { CheckboxDropdown } from "@/components/admin/CheckboxDropdown";
import { useCategories } from "@/components/categories/CategoriesProvider";
import {
  documentCategoryLabel,
  defaultDocumentCategoryForItem,
  type DocumentCategory,
} from "@/lib/document-categories";
import {
  ADDITIONAL_VIEWERS_LABEL,
  DOCUMENT_LINKED_TRAVELLERS_LABEL,
  parseCoveredTravellers,
  parseExtraViewers,
} from "@/lib/item-document-utils";
import type { ItemDocument } from "@/lib/schema";

export type EditableDocument = Pick<
  ItemDocument,
  "label" | "category" | "travellerName" | "coversTravellers" | "extraViewers"
>;

function TravellerCheckboxList({
  options,
  selected,
  onToggle,
  emptyMessage = "No travellers available yet.",
}: {
  options: string[];
  selected: string[];
  onToggle: (name: string) => void;
  emptyMessage?: string;
}) {
  if (options.length === 0) {
    return <p className="text-sm text-stone-400">{emptyMessage}</p>;
  }

  return (
    <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-stone-200 p-2">
      {options.map((name) => (
        <label
          key={name}
          className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-stone-50"
        >
          <input
            type="checkbox"
            checked={selected.includes(name)}
            onChange={() => onToggle(name)}
          />
          <span>{name}</span>
        </label>
      ))}
    </div>
  );
}

export function DocumentEditForm({
  doc,
  travellerOptions,
  viewerOptions,
  busy,
  onCancel,
  onSave,
  travellerEmptyMessage,
}: {
  doc: EditableDocument;
  travellerOptions: string[];
  viewerOptions: string[];
  busy: boolean;
  onCancel: () => void;
  onSave: (
    label: string,
    category: DocumentCategory,
    coversTravellers: string[],
    extraViewers: string[],
  ) => Promise<void>;
  travellerEmptyMessage?: string;
}) {
  const { documentCategories } = useCategories();
  const [label, setLabel] = useState(doc.label);
  const [category, setCategory] = useState<DocumentCategory>(
    defaultDocumentCategoryForItem(doc.category, documentCategories),
  );
  const [coveredTravellers, setCoveredTravellers] = useState(() =>
    parseCoveredTravellers(doc),
  );
  const [extraViewers, setExtraViewers] = useState(() =>
    parseExtraViewers(doc.extraViewers),
  );
  const [error, setError] = useState<string | null>(null);

  function toggleTraveller(name: string) {
    setCoveredTravellers((current) =>
      current.includes(name)
        ? current.filter((entry) => entry !== name)
        : [...current, name],
    );
  }

  async function handleSave() {
    const trimmedLabel = label.trim();
    if (!trimmedLabel) {
      setError("Enter a document label.");
      return;
    }
    if (coveredTravellers.length === 0) {
      setError("Select at least one traveller.");
      return;
    }
    setError(null);
    await onSave(trimmedLabel, category, coveredTravellers, extraViewers);
  }

  return (
    <div className="mt-3 space-y-3 rounded-lg border border-brand/20 bg-white p-3">
      <label className="block text-sm">
        <span className="mb-1 block text-stone-500">Category</span>
        <select
          value={category}
          onChange={(event) =>
            setCategory(event.target.value as DocumentCategory)
          }
          className="w-full rounded-lg border border-stone-200 px-3 py-2"
        >
          {documentCategories.map((entry) => (
            <option key={entry.slug} value={entry.slug}>
              {documentCategoryLabel(entry.slug, documentCategories)}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-stone-500">Label</span>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Boarding pass, travel insurance, visa…"
          className="w-full rounded-lg border border-stone-200 px-3 py-2"
        />
      </label>
      <div className="text-sm">
        <p className="mb-2 text-stone-500">{DOCUMENT_LINKED_TRAVELLERS_LABEL}</p>
        <TravellerCheckboxList
          options={travellerOptions}
          selected={coveredTravellers}
          onToggle={toggleTraveller}
          emptyMessage={travellerEmptyMessage}
        />
      </div>
      <CheckboxDropdown
        label={ADDITIONAL_VIEWERS_LABEL}
        options={viewerOptions}
        value={extraViewers}
        onChange={setExtraViewers}
        emptyLabel="No additional viewers"
      />
      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void handleSave()}
          className="rounded-lg bg-brand-deep px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save changes"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onCancel}
          className="rounded-lg border border-stone-200 px-3 py-1.5 text-sm text-stone-600"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

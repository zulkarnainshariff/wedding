"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Upload, X } from "lucide-react";
import { CheckboxDropdown } from "@/components/admin/CheckboxDropdown";
import {
  DOCUMENT_CATEGORIES,
  documentCategoryLabel,
  defaultDocumentCategoryForItem,
  type DocumentCategory,
} from "@/lib/document-categories";
import {
  ADDITIONAL_VIEWERS_LABEL,
  DOCUMENT_LINKED_TRAVELLERS_LABEL,
} from "@/lib/item-document-utils";
import {
  bindNativeFilePickerCloseListeners,
  clearNativeFilePickerOpen,
  markNativeFilePickerOpen,
} from "@/lib/native-file-picker";
import { PortaledFileInput } from "@/components/ui/PortaledFileInput";
import { useToast } from "@/components/ui/ToastProvider";
import type { ItineraryItem } from "@/lib/schema";

function TravellerCheckboxList({
  options,
  selected,
  onToggle,
}: {
  options: string[];
  selected: string[];
  onToggle: (name: string) => void;
}) {
  if (options.length === 0) {
    return (
      <p className="text-sm text-stone-400">No travellers available yet.</p>
    );
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

export function DocumentUploadForm({
  item = null,
  onSuccess,
  onCancel,
}: {
  item?: ItineraryItem | null;
  onSuccess?: () => void;
  onCancel?: () => void;
}) {
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputId = `document-upload-${item?.id ?? "standalone"}`;
  const [viewerOptions, setViewerOptions] = useState<string[]>([]);
  const [travellerOptions, setTravellerOptions] = useState<string[]>([]);
  const [category, setCategory] = useState<DocumentCategory>(
    defaultDocumentCategoryForItem(item?.category),
  );
  const [label, setLabel] = useState("");
  const [coveredTravellers, setCoveredTravellers] = useState<string[]>([]);
  const [extraViewers, setExtraViewers] = useState<string[]>([]);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uploadUrl = useMemo(
    () => (item ? `/api/items/${item.id}/documents` : "/api/documents"),
    [item],
  );

  useEffect(() => bindNativeFilePickerCloseListeners(), []);

  useEffect(() => {
    void fetch("/api/users/brief")
      .then((response) => (response.ok ? response.json() : []))
      .then((rows: { username: string }[]) => {
        const usernames = rows
          .map((row) => row.username)
          .sort((a, b) => a.localeCompare(b));
        setViewerOptions(usernames);
        setTravellerOptions(usernames);
      })
      .catch(() => undefined);
  }, []);

  function toggleTraveller(name: string) {
    setCoveredTravellers((current) =>
      current.includes(name)
        ? current.filter((entry) => entry !== name)
        : [...current, name],
    );
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const file = fileInputRef.current?.files?.[0];
    if (!file || coveredTravellers.length === 0) {
      setError("Choose at least one traveller and a file.");
      return;
    }

    setUploading(true);
    setError(null);

    const body = new FormData();
    body.append("file", file);
    body.append("travellerName", coveredTravellers[0]);
    body.append("coveredTravellers", coveredTravellers.join(","));
    body.append("label", label.trim() || file.name.replace(/\.[^.]+$/, "") || "Document");
    body.append("category", category);
    body.append("extraViewers", extraViewers.join(","));

    try {
      const response = await fetch(uploadUrl, { method: "POST", body });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(payload.error ?? "Upload failed.");
      }

      toast.success(`Uploaded ${file.name}`);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setSelectedFileName(null);
      setLabel("");
      setCoveredTravellers([]);
      setExtraViewers([]);
      onSuccess?.();
    } catch (uploadError) {
      const message =
        uploadError instanceof Error ? uploadError.message : "Upload failed.";
      setError(message);
      toast.error(message);
    } finally {
      setUploading(false);
      clearNativeFilePickerOpen();
    }
  }

  return (
    <form
      onSubmit={(event) => void handleSubmit(event)}
      className="space-y-3 rounded-xl border border-dashed border-stone-300 bg-white p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-stone-700">
            {item ? "Upload document to this item" : "Upload shared document"}
          </p>
          <p className="mt-1 text-xs text-stone-500">
            {item
              ? "This document stays linked to the selected itinerary item."
              : "This document is not linked to a specific itinerary item."}
          </p>
        </div>
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full border border-stone-200 p-1.5 text-stone-500 hover:bg-stone-50"
            aria-label="Cancel"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      <label className="block text-sm">
        <span className="mb-1 block text-stone-500">Category</span>
        <select
          value={category}
          onChange={(event) =>
            setCategory(event.target.value as DocumentCategory)
          }
          className="w-full rounded-lg border border-stone-200 px-3 py-2"
        >
          {DOCUMENT_CATEGORIES.map((entry) => (
            <option key={entry} value={entry}>
              {documentCategoryLabel(entry)}
            </option>
          ))}
        </select>
      </label>

      <div className="text-sm">
        <p className="mb-2 text-stone-500">{DOCUMENT_LINKED_TRAVELLERS_LABEL}</p>
        <TravellerCheckboxList
          options={travellerOptions}
          selected={coveredTravellers}
          onToggle={toggleTraveller}
        />
      </div>

      <label className="block text-sm">
        <span className="mb-1 block text-stone-500">Label</span>
        <input
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          placeholder="Boarding pass, travel insurance, visa…"
          className="w-full rounded-lg border border-stone-200 px-3 py-2"
        />
      </label>

      <CheckboxDropdown
        label={ADDITIONAL_VIEWERS_LABEL}
        options={viewerOptions}
        value={extraViewers}
        onChange={setExtraViewers}
        emptyLabel="No additional viewers"
      />

      <div className="text-sm">
        <span className="mb-1 block text-stone-500">File (PDF or image)</span>
        <label
          htmlFor={inputId}
          onMouseDown={() => markNativeFilePickerOpen()}
          className="flex w-full cursor-pointer items-center gap-2 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2.5 text-sm transition hover:border-brand/30 hover:bg-accent-pearl/30"
        >
          <Upload className="h-4 w-4 shrink-0 text-brand-deep" />
          <span className="truncate">
            {selectedFileName ?? "Choose PDF or image…"}
          </span>
        </label>
        {selectedFileName ? (
          <button
            type="button"
            onClick={() => {
              if (fileInputRef.current) fileInputRef.current.value = "";
              setSelectedFileName(null);
            }}
            className="mt-2 text-sm text-stone-500 hover:text-stone-700"
          >
            Clear selected file
          </button>
        ) : null}
        <PortaledFileInput
          inputRef={fileInputRef}
          id={inputId}
          name="file"
          accept=".pdf,image/jpeg,image/png,image/webp"
          onChange={(event) => {
            setSelectedFileName(event.target.files?.[0]?.name ?? null);
            clearNativeFilePickerOpen();
          }}
        />
      </div>

      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={uploading}
        className="inline-flex items-center gap-2 rounded-xl bg-brand-deep px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        <Upload className="h-4 w-4" />
        {uploading ? "Uploading…" : "Upload"}
      </button>
    </form>
  );
}

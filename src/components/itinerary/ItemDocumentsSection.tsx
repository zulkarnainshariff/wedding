"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FileText, Pencil, Plus, Trash2, Upload, X } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useDiscardConfirm } from "@/hooks/useDiscardConfirm";
import { useAuth } from "@/components/auth/AuthProvider";
import { CheckboxDropdown } from "@/components/admin/CheckboxDropdown";
import { IconTooltip } from "@/components/ui/IconTooltip";
import { useToast } from "@/components/ui/ToastProvider";
import {
  ADDITIONAL_VIEWERS_LABEL,
  DOCUMENT_LINKED_TRAVELLERS_LABEL,
  extractTravellerOptions,
  parseCoveredTravellers,
  parseExtraViewers,
} from "@/lib/item-document-utils";
import { canSeeItemAdditionalViewers } from "@/lib/item-viewers";
import type { ItemDocument, ItineraryItem } from "@/lib/schema";

function defaultLabelFromFileName(fileName: string): string {
  const base = fileName.replace(/\.[^.]+$/, "").trim();
  return base || "Document";
}

function uploadFormDataWithProgress(
  url: string,
  body: FormData,
  onProgress: (percent: number) => void,
): Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) {
        onProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)));
      }
    };
    xhr.onload = () => {
      resolve({
        ok: xhr.status >= 200 && xhr.status < 300,
        status: xhr.status,
        json: async () => {
          try {
            return JSON.parse(xhr.responseText) as unknown;
          } catch {
            return {};
          }
        },
      });
    };
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.send(body);
  });
}

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
      <p className="text-sm text-stone-400">No travellers listed on this item yet.</p>
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

function DocumentEditForm({
  doc,
  travellerOptions,
  viewerOptions,
  busy,
  onCancel,
  onSave,
}: {
  doc: ItemDocument;
  travellerOptions: string[];
  viewerOptions: string[];
  busy: boolean;
  onCancel: () => void;
  onSave: (
    label: string,
    coversTravellers: string[],
    extraViewers: string[],
  ) => Promise<void>;
}) {
  const [label, setLabel] = useState(doc.label);
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
    await onSave(trimmedLabel, coveredTravellers, extraViewers);
  }

  return (
    <div className="mt-3 space-y-3 rounded-lg border border-brand/20 bg-white p-3">
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

export function ItemDocumentsSection({ item }: { item: ItineraryItem }) {
  const { canEdit, user } = useAuth();
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [documents, setDocuments] = useState<ItemDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [coveredTravellers, setCoveredTravellers] = useState<string[]>([]);
  const [label, setLabel] = useState("");
  const [extraViewers, setExtraViewers] = useState<string[]>([]);
  const [editingDocId, setEditingDocId] = useState<number | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [savingDocId, setSavingDocId] = useState<number | null>(null);
  const [viewerOptions, setViewerOptions] = useState<string[]>([]);

  const travellerOptions = useMemo(
    () => extractTravellerOptions(item, viewerOptions),
    [item, viewerOptions],
  );
  const showDocumentViewers = canSeeItemAdditionalViewers(item, user);

  const resetUploadForm = useCallback(() => {
    if (fileInputRef.current) fileInputRef.current.value = "";
    setSelectedFileName(null);
    setCoveredTravellers([]);
    setLabel("");
    setExtraViewers([]);
    setError(null);
    setAddOpen(false);
  }, []);

  const {
    discardConfirmOpen,
    requestDismiss,
    confirmDiscard,
    cancelDiscard,
  } = useDiscardConfirm(resetUploadForm);

  const isUploadFormDirty = useMemo(
    () =>
      Boolean(
        selectedFileName ||
          label.trim() ||
          coveredTravellers.length > 0 ||
          extraViewers.length > 0,
      ),
    [selectedFileName, label, coveredTravellers, extraViewers],
  );

  useEffect(() => {
    void fetch("/api/users/brief")
      .then((response) => (response.ok ? response.json() : []))
      .then((rows: { username: string }[]) => {
        setViewerOptions(
          rows
            .map((row) => row.username)
            .sort((a, b) => a.localeCompare(b)),
        );
      })
      .catch(() => undefined);
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/items/${item.id}/documents`);
      if (response.ok) {
        setDocuments(await response.json());
      }
    } finally {
      setLoading(false);
    }
  }, [item.id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  function toggleTraveller(name: string) {
    setCoveredTravellers((current) =>
      current.includes(name)
        ? current.filter((entry) => entry !== name)
        : [...current, name],
    );
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setSelectedFileName(file?.name ?? null);
    setError(null);
  }

  async function handleUpload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const file = fileInputRef.current?.files?.[0];
    if (!file || coveredTravellers.length === 0) {
      setError("Choose at least one traveller and a file.");
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setError(null);

    const body = new FormData();
    body.append("file", file);
    body.append("travellerName", coveredTravellers[0]);
    body.append("coveredTravellers", coveredTravellers.join(","));
    body.append(
      "label",
      label.trim() || defaultLabelFromFileName(file.name),
    );
    body.append("extraViewers", extraViewers.join(","));

    try {
      const response = await uploadFormDataWithProgress(
        `/api/items/${item.id}/documents`,
        body,
        setUploadProgress,
      );

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        const message =
          payload.error ??
          (response.status === 403
            ? "You do not have permission to upload documents."
            : response.status === 401
              ? "Please sign in again."
              : `Upload failed (${response.status}).`);
        setError(message);
        toast.error(message);
        return;
      }

      if (fileInputRef.current) fileInputRef.current.value = "";
      setSelectedFileName(null);
      setCoveredTravellers([]);
      setLabel("");
      setExtraViewers([]);
      setUploadProgress(100);
      setAddOpen(false);
      toast.success(`Uploaded ${file.name}`);
      await refresh();
    } catch {
      const message = "Upload failed — check your connection and try again.";
      setError(message);
      toast.error(message);
    } finally {
      setUploading(false);
      window.setTimeout(() => setUploadProgress(null), 800);
    }
  }

  async function handleSaveDocument(
    docId: number,
    docLabel: string,
    covers: string[],
    viewers: string[],
  ) {
    setSavingDocId(docId);
    const response = await fetch(`/api/items/documents/${docId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        label: docLabel,
        coversTravellers: covers,
        extraViewers: viewers,
      }),
    });
    setSavingDocId(null);

    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      toast.error(payload.error ?? "Could not save document settings.");
      return;
    }

    toast.success("Document settings saved.");
    setEditingDocId(null);
    await refresh();
  }

  async function handleDelete(docId: number) {
    if (!confirm("Delete this document?")) return;
    const response = await fetch(`/api/items/documents/${docId}`, {
      method: "DELETE",
    });
    if (response.ok) {
      toast.success("Document deleted.");
      if (editingDocId === docId) setEditingDocId(null);
      await refresh();
    } else {
      toast.error("Could not delete document.");
    }
  }

  if (!loading && documents.length === 0 && !canEdit) {
    return null;
  }

  const showSectionBody = loading || documents.length > 0 || addOpen;

  return (
    <div className="border-t border-stone-100 py-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold tracking-wide text-stone-500 uppercase">
            Documents
          </h3>
          {showSectionBody && (
            <p className="mt-1 text-xs text-stone-500">
              Travelling party members can view each other&apos;s documents. Add{" "}
              {ADDITIONAL_VIEWERS_LABEL.toLowerCase()} (e.g. parents) when uploading.
            </p>
          )}
        </div>
        {canEdit && !addOpen && (
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-brand-deep hover:underline"
          >
            <Plus className="h-4 w-4" />
            Upload document
          </button>
        )}
      </div>

      {showSectionBody && (
        <>
          {loading ? (
            <p className="mt-3 text-sm text-stone-400">Loading documents…</p>
          ) : documents.length > 0 ? (
            <ul className="mt-3 space-y-2">
              {documents.map((doc) => {
            const covered = parseCoveredTravellers(doc);
            const additional = parseExtraViewers(doc.extraViewers);
            const isEditing = editingDocId === doc.id;

            return (
              <li
                key={doc.id}
                className="rounded-xl border border-stone-200 bg-stone-50 px-3 py-2"
              >
                <div className="flex flex-col gap-2 sm:grid sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start sm:gap-3">
                  <div className="min-w-0">
                    <a
                      href={`/api/items/documents/${doc.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex max-w-full items-center gap-2 text-sm text-brand-deep hover:underline"
                    >
                      <FileText className="h-4 w-4 shrink-0" />
                      <IconTooltip
                        label={`${doc.label} · ${doc.fileName}`}
                        className="min-w-0"
                      >
                        <span className="block truncate">
                          {doc.label} · {doc.fileName}
                        </span>
                      </IconTooltip>
                    </a>
                    <p className="mt-1 text-xs text-stone-500">
                      Linked to: {covered.join(", ")}
                    </p>
                    {showDocumentViewers && additional.length > 0 && (
                      <p className="mt-0.5 text-xs text-stone-500">
                        {ADDITIONAL_VIEWERS_LABEL}: {additional.join(", ")}
                      </p>
                    )}
                  </div>
                  {canEdit && (
                    <div className="flex shrink-0 gap-1 self-end sm:self-start">
                      <button
                        type="button"
                        onClick={() =>
                          setEditingDocId(isEditing ? null : doc.id)
                        }
                        className="rounded-lg border border-stone-200 p-1.5 text-stone-600 hover:bg-white"
                        aria-label="Edit document settings"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDelete(doc.id)}
                        className="rounded-lg border border-red-200 p-1.5 text-red-600 hover:bg-red-50"
                        aria-label="Delete document"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>

                {canEdit && isEditing && (
                  <DocumentEditForm
                    key={doc.id}
                    doc={doc}
                    travellerOptions={travellerOptions}
                    viewerOptions={viewerOptions}
                    busy={savingDocId === doc.id}
                    onCancel={() => setEditingDocId(null)}
                    onSave={(docLabel, covers, viewers) =>
                      handleSaveDocument(doc.id, docLabel, covers, viewers)
                    }
                  />
                )}
              </li>
            );
          })}
            </ul>
          ) : null}

          {canEdit && addOpen && (
            <form
              onSubmit={(e) => void handleUpload(e)}
              className="mt-4 space-y-3 rounded-xl border border-dashed border-stone-300 bg-white p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-medium text-stone-700">Upload document</p>
                <button
                  type="button"
                  onClick={() => requestDismiss(isUploadFormDirty)}
                  className="rounded-full border border-stone-200 p-1.5 text-stone-500 hover:bg-stone-50"
                  aria-label="Cancel"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="text-sm sm:col-span-2">
              <p className="mb-2 text-stone-500">{DOCUMENT_LINKED_TRAVELLERS_LABEL}</p>
              <TravellerCheckboxList
                options={travellerOptions}
                selected={coveredTravellers}
                onToggle={toggleTraveller}
              />
            </div>
            <label className="block text-sm sm:col-span-2">
              <span className="mb-1 block text-stone-500">Label</span>
              <input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Boarding pass, travel insurance, visa…"
                className="w-full rounded-lg border border-stone-200 px-3 py-2"
              />
            </label>
            <div className="sm:col-span-2">
              <CheckboxDropdown
                label={ADDITIONAL_VIEWERS_LABEL}
                options={viewerOptions}
                value={extraViewers}
                onChange={setExtraViewers}
                emptyLabel="No additional viewers"
              />
            </div>
            <div className="text-sm sm:col-span-2">
              <span className="mb-1 block text-stone-500">File (PDF or image)</span>
              <label
                htmlFor={`document-file-${item.id}`}
                className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2.5 text-left text-sm transition hover:border-brand/30 hover:bg-accent-pearl/30"
              >
                <span className="inline-flex min-w-0 items-center gap-2 text-stone-700">
                  <Upload className="h-4 w-4 shrink-0 text-brand-deep" />
                  <span className="truncate">
                    {selectedFileName ?? "Choose PDF or image…"}
                  </span>
                </span>
                {selectedFileName && (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      if (fileInputRef.current) fileInputRef.current.value = "";
                      setSelectedFileName(null);
                    }}
                    className="shrink-0 cursor-pointer rounded p-0.5 text-stone-400 hover:text-stone-600"
                    aria-label="Clear selected file"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </label>
              <input
                ref={fileInputRef}
                id={`document-file-${item.id}`}
                name="file"
                type="file"
                accept=".pdf,image/jpeg,image/png,image/webp"
                className="sr-only"
                required
                onChange={handleFileChange}
              />
            </div>
          </div>

          {uploadProgress !== null && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-stone-500">
                <span>{uploading ? "Uploading…" : "Upload complete"}</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-stone-200">
                <div
                  className="h-full rounded-full bg-brand-deep transition-[width] duration-200"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={uploading}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-deep px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            <Upload className="h-4 w-4" />
            {uploading ? "Uploading…" : "Upload"}
          </button>
            </form>
          )}
        </>
      )}
      <ConfirmDialog
        open={discardConfirmOpen}
        title="Discard changes?"
        message="You have unsaved document upload details. Close without saving?"
        confirmLabel="Discard"
        destructive
        onClose={cancelDiscard}
        onConfirm={confirmDiscard}
      />
    </div>
  );
}

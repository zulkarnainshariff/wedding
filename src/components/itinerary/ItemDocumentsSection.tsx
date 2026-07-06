"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FileText, Pencil, Plus, Trash2, Users } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { DocumentEditForm } from "@/components/documents/DocumentEditForm";
import { DocumentUploadForm } from "@/components/documents/DocumentUploadForm";
import { useCategories } from "@/components/categories/CategoriesProvider";
import { IconTooltip } from "@/components/ui/IconTooltip";
import { useToast } from "@/components/ui/ToastProvider";
import {
  defaultDocumentCategoryForItem,
  documentCategoryLabel,
} from "@/lib/document-categories";
import {
  ADDITIONAL_VIEWERS_LABEL,
  extractTravellerOptions,
  isSharedDocument,
  parseCoveredTravellers,
  parseExtraViewers,
} from "@/lib/item-document-utils";
import { canSeeItemAdditionalViewers } from "@/lib/item-viewers";
import type { ItemDocument, ItineraryItem } from "@/lib/schema";

export function ItemDocumentsSection({ item }: { item: ItineraryItem }) {
  const { canEdit, user } = useAuth();
  const { documentCategories } = useCategories();
  const toast = useToast();
  const [documents, setDocuments] = useState<ItemDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingDocId, setEditingDocId] = useState<number | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [savingDocId, setSavingDocId] = useState<number | null>(null);
  const [viewerOptions, setViewerOptions] = useState<string[]>([]);

  const travellerOptions = useMemo(
    () => extractTravellerOptions(item, viewerOptions),
    [item, viewerOptions],
  );
  const showDocumentViewers = canSeeItemAdditionalViewers(item, user);

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

  async function handleSaveDocument(
    docId: number,
    docLabel: string,
    docCategory: string,
    covers: string[],
    viewers: string[],
  ) {
    setSavingDocId(docId);
    const response = await fetch(`/api/items/documents/${docId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        label: docLabel,
        category: docCategory,
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
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-stone-200/80 px-2 py-0.5 text-[11px] font-medium text-stone-600">
                        {documentCategoryLabel(
                          defaultDocumentCategoryForItem(
                            doc.category,
                            documentCategories,
                          ),
                          documentCategories,
                        )}
                      </span>
                      {isSharedDocument(doc) && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-brand/10 px-2 py-0.5 text-[11px] font-medium text-brand-deep">
                          <Users className="h-3 w-3" />
                          Shared
                        </span>
                      )}
                    </div>
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
                    onSave={(docLabel, docCategory, covers, viewers) =>
                      handleSaveDocument(
                        doc.id,
                        docLabel,
                        docCategory,
                        covers,
                        viewers,
                      )
                    }
                    travellerEmptyMessage="No travellers listed on this item yet."
                  />
                )}
              </li>
            );
          })}
            </ul>
          ) : null}

          {canEdit && addOpen && (
            <div className="mt-4">
              <DocumentUploadForm
                item={item}
                onSuccess={() => {
                  setAddOpen(false);
                  void refresh();
                }}
                onCancel={() => setAddOpen(false)}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}

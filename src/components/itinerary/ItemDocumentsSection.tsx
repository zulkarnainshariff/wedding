"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FileText, Trash2, Upload } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { parseCoveredTravellers, extractTravellerOptions } from "@/lib/item-document-utils";
import type { ItemDocument, ItineraryItem } from "@/lib/schema";

export function ItemDocumentsSection({ item }: { item: ItineraryItem }) {
  const { canEdit } = useAuth();
  const [documents, setDocuments] = useState<ItemDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [coveredTravellers, setCoveredTravellers] = useState<string[]>([]);
  const [label, setLabel] = useState("ESTA");
  const [extraViewers, setExtraViewers] = useState("");

  const travellerOptions = useMemo(
    () => extractTravellerOptions(item),
    [item],
  );

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

  async function handleUpload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fileInput = form.elements.namedItem("file") as HTMLInputElement;
    const file = fileInput.files?.[0];
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
    body.append("label", label);
    body.append("extraViewers", extraViewers);

    const response = await fetch(`/api/items/${item.id}/documents`, {
      method: "POST",
      body,
    });

    setUploading(false);

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      setError(
        payload?.error ??
          (response.status === 403
            ? "You do not have permission to upload documents."
            : response.status === 401
              ? "Please sign in again."
              : `Upload failed (${response.status}).`),
      );
      return;
    }

    fileInput.value = "";
    setCoveredTravellers([]);
    setExtraViewers("");
    await refresh();
  }

  async function handleDelete(docId: number) {
    if (!confirm("Delete this document?")) return;
    const response = await fetch(`/api/items/documents/${docId}`, {
      method: "DELETE",
    });
    if (response.ok) {
      await refresh();
    }
  }

  return (
    <div className="border-t border-stone-100 py-4">
      <h3 className="text-sm font-semibold tracking-wide text-stone-500 uppercase">
        Documents
      </h3>
      <p className="mt-1 text-xs text-stone-500">
        Travelling party members can view each other&apos;s documents. Add extra
        viewers (e.g. parents) when uploading.
      </p>

      {loading ? (
        <p className="mt-3 text-sm text-stone-400">Loading documents…</p>
      ) : documents.length === 0 ? (
        <p className="mt-3 text-sm text-stone-400">No documents uploaded yet.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {documents.map((doc) => {
            const covered = parseCoveredTravellers(doc);
            return (
              <li
                key={doc.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2"
              >
                <div className="min-w-0">
                  <a
                    href={`/api/items/documents/${doc.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-w-0 items-center gap-2 text-sm text-brand-deep hover:underline"
                  >
                    <FileText className="h-4 w-4 shrink-0" />
                    <span className="truncate">
                      {doc.label} · {doc.fileName}
                    </span>
                  </a>
                  <p className="mt-1 text-xs text-stone-500">
                    Covers: {covered.join(", ")}
                  </p>
                </div>
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => void handleDelete(doc.id)}
                    className="shrink-0 rounded-lg border border-red-200 p-1.5 text-red-600 hover:bg-red-50"
                    aria-label="Delete document"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {canEdit && (
        <form
          onSubmit={(e) => void handleUpload(e)}
          className="mt-4 space-y-3 rounded-xl border border-dashed border-stone-300 bg-white p-4"
        >
          <p className="text-sm font-medium text-stone-700">Upload document</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="text-sm sm:col-span-2">
              <p className="mb-2 text-stone-500">Covers travellers</p>
              {travellerOptions.length === 0 ? (
                <p className="text-sm text-stone-400">
                  No travellers listed on this item yet.
                </p>
              ) : (
                <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-stone-200 p-2">
                  {travellerOptions.map((name) => (
                    <label
                      key={name}
                      className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-stone-50"
                    >
                      <input
                        type="checkbox"
                        checked={coveredTravellers.includes(name)}
                        onChange={() => toggleTraveller(name)}
                      />
                      <span>{name}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
            <label className="block text-sm">
              <span className="mb-1 block text-stone-500">Label</span>
              <input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="ESTA, boarding pass, policy PDF…"
                className="w-full rounded-lg border border-stone-200 px-3 py-2"
              />
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="mb-1 block text-stone-500">
                Extra viewers (usernames, comma-separated)
              </span>
              <input
                value={extraViewers}
                onChange={(e) => setExtraViewers(e.target.value)}
                placeholder="Enter usernames allowed to view this document, separated by commas"
                className="w-full rounded-lg border border-stone-200 px-3 py-2"
              />
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="mb-1 block text-stone-500">File (PDF or image)</span>
              <input
                name="file"
                type="file"
                accept=".pdf,image/jpeg,image/png,image/webp"
                className="w-full text-sm"
                required
              />
            </label>
          </div>
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
    </div>
  );
}

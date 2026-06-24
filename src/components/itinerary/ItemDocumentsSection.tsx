"use client";

import { useCallback, useEffect, useState } from "react";
import { FileText, Trash2, Upload } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import type { ItemDocument, ItineraryItem } from "@/lib/schema";
import { TRAVELLER_NAMES } from "@/lib/travellers";

export function ItemDocumentsSection({ item }: { item: ItineraryItem }) {
  const { canEdit } = useAuth();
  const [documents, setDocuments] = useState<ItemDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [travellerName, setTravellerName] = useState("");
  const [label, setLabel] = useState("ESTA");
  const [extraViewers, setExtraViewers] = useState("");

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

  async function handleUpload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fileInput = form.elements.namedItem("file") as HTMLInputElement;
    const file = fileInput.files?.[0];
    if (!file || !travellerName) {
      setError("Choose a traveller and file.");
      return;
    }

    setUploading(true);
    setError(null);

    const body = new FormData();
    body.append("file", file);
    body.append("travellerName", travellerName);
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
      setError(payload?.error ?? "Upload failed.");
      return;
    }

    fileInput.value = "";
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

  const grouped = documents.reduce<Record<string, ItemDocument[]>>((acc, doc) => {
    const key = doc.travellerName;
    acc[key] = acc[key] ?? [];
    acc[key].push(doc);
    return acc;
  }, {});

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
        <div className="mt-3 space-y-4">
          {Object.entries(grouped).map(([traveller, docs]) => (
            <div key={traveller}>
              <p className="text-sm font-medium text-stone-700">{traveller}</p>
              <ul className="mt-2 space-y-2">
                {docs.map((doc) => (
                  <li
                    key={doc.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2"
                  >
                    <a
                      href={`/api/items/documents/${doc.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-w-0 items-center gap-2 text-sm text-[#1e3a5f] hover:underline"
                    >
                      <FileText className="h-4 w-4 shrink-0" />
                      <span className="truncate">
                        {doc.label} · {doc.fileName}
                      </span>
                    </a>
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
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {canEdit && (
        <form onSubmit={(e) => void handleUpload(e)} className="mt-4 space-y-3 rounded-xl border border-dashed border-stone-300 bg-white p-4">
          <p className="text-sm font-medium text-stone-700">Upload document</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1 block text-stone-500">Traveller</span>
              <select
                value={travellerName}
                onChange={(e) => setTravellerName(e.target.value)}
                className="w-full rounded-lg border border-stone-200 px-3 py-2"
                required
              >
                <option value="">Select…</option>
                {TRAVELLER_NAMES.filter((name) => name !== "Everyone").map(
                  (name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ),
                )}
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-stone-500">Label</span>
              <input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="ESTA, boarding pass…"
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
                placeholder="shireen, zulfikar"
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
            className="inline-flex items-center gap-2 rounded-xl bg-[#1e3a5f] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            <Upload className="h-4 w-4" />
            {uploading ? "Uploading…" : "Upload"}
          </button>
        </form>
      )}
    </div>
  );
}

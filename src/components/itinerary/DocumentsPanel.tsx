"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ExternalLink, FileText } from "lucide-react";
import { useItineraryUI } from "@/components/itinerary/ItineraryUIContext";
import { IconTooltip } from "@/components/ui/IconTooltip";
import { useDisplayFormat } from "@/hooks/useDisplayFormat";
import { CATEGORY_META, type Category } from "@/lib/types";
import { CATEGORY_STYLES, getCategoryIcon } from "@/lib/category-ui";
import type { DocumentListEntry } from "@/lib/document-queries";

function DocumentRow({
  entry,
  onOpenLinkedItem,
}: {
  entry: DocumentListEntry;
  onOpenLinkedItem: (itemId: number) => void;
}) {
  const { formatDateTime } = useDisplayFormat();
  const styles = CATEGORY_STYLES[entry.itemCategory];
  const CategoryIcon = getCategoryIcon(entry.itemCategory);
  const displayName = `${entry.label} · ${entry.fileName}`;

  return (
    <li className="rounded-xl border border-stone-200 bg-stone-50 px-3 py-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <a
            href={`/api/items/documents/${entry.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex max-w-full items-center gap-2 text-sm font-medium text-brand-deep hover:underline"
          >
            <FileText className="h-4 w-4 shrink-0" />
            <IconTooltip label={displayName} className="min-w-0">
              <span className="block truncate">{displayName}</span>
            </IconTooltip>
            <ExternalLink className="h-3.5 w-3.5 shrink-0 text-stone-400" />
          </a>
          <p className="mt-1 text-xs text-stone-500">
            Linked to: {entry.coversTravellers.join(", ")}
          </p>
          <p className="mt-0.5 text-xs text-stone-400">
            Uploaded {formatDateTime(entry.createdAt)}
          </p>
        </div>

        <button
          type="button"
          onClick={() => onOpenLinkedItem(entry.itemId)}
          className={[
            "inline-flex max-w-full shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm transition hover:bg-white",
            styles.border,
            styles.text,
          ].join(" ")}
        >
          <span
            className={[
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
              styles.bg,
            ].join(" ")}
          >
            <CategoryIcon className="h-4 w-4" />
          </span>
          <span className="min-w-0">
            <span className="block text-[10px] font-semibold tracking-wide uppercase opacity-70">
              {CATEGORY_META[entry.itemCategory].shortLabel}
            </span>
            <span className="block truncate font-medium">{entry.itemTitle}</span>
          </span>
        </button>
      </div>
    </li>
  );
}

function CategorySection({
  category,
  entries,
  onOpenLinkedItem,
}: {
  category: Category;
  entries: DocumentListEntry[];
  onOpenLinkedItem: (itemId: number) => void;
}) {
  const styles = CATEGORY_STYLES[category];
  const CategoryIcon = getCategoryIcon(category);

  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <span
          className={[
            "flex h-8 w-8 items-center justify-center rounded-lg",
            styles.bg,
            styles.text,
          ].join(" ")}
        >
          <CategoryIcon className="h-4 w-4" />
        </span>
        <h2 className="font-serif text-lg text-brand-deep">
          {CATEGORY_META[category].label}
        </h2>
        <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-600">
          {entries.length}
        </span>
      </div>
      <ul className="space-y-2">
        {entries.map((entry) => (
          <DocumentRow
            key={entry.id}
            entry={entry}
            onOpenLinkedItem={onOpenLinkedItem}
          />
        ))}
      </ul>
    </section>
  );
}

export function DocumentsPanelContent({
  onOpenLinkedItem,
}: {
  onOpenLinkedItem: (itemId: number) => void;
}) {
  const [documents, setDocuments] = useState<DocumentListEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/documents");
      if (!response.ok) {
        throw new Error("Could not load documents.");
      }
      const rows = (await response.json()) as DocumentListEntry[];
      setDocuments(rows);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Could not load documents.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const grouped = useMemo(() => {
    const map = new Map<Category, DocumentListEntry[]>();
    for (const entry of documents) {
      const list = map.get(entry.itemCategory) ?? [];
      list.push(entry);
      map.set(entry.itemCategory, list);
    }
    return map;
  }, [documents]);

  const categories = useMemo(
    () => [...grouped.keys()].sort((a, b) => a.localeCompare(b)),
    [grouped],
  );

  if (loading) {
    return <p className="text-sm text-stone-500">Loading documents…</p>;
  }

  if (error) {
    return (
      <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
        {error}
      </p>
    );
  }

  if (documents.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-stone-300 bg-white/60 p-10 text-center text-stone-500">
        No documents are visible for your account yet.
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {categories.map((category) => (
        <CategorySection
          key={category}
          category={category}
          entries={grouped.get(category) ?? []}
          onOpenLinkedItem={onOpenLinkedItem}
        />
      ))}
    </div>
  );
}

export function DocumentsPanel() {
  const { openItem } = useItineraryUI();
  return <DocumentsPanelContent onOpenLinkedItem={openItem} />;
}

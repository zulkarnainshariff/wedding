"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ExternalLink, FileText, Plus, Users } from "lucide-react";
import { DocumentUploadForm } from "@/components/documents/DocumentUploadForm";
import { useItineraryUI } from "@/components/itinerary/ItineraryUIContext";
import { IconTooltip } from "@/components/ui/IconTooltip";
import { useDisplayFormat } from "@/hooks/useDisplayFormat";
import { documentCategoryLabel } from "@/lib/document-categories";
import { CATEGORY_META, type Category } from "@/lib/types";
import { CATEGORY_STYLES, getCategoryIcon } from "@/lib/category-ui";
import type { DocumentListEntry, DocumentViewMode } from "@/lib/document-queries";

function SharedBadge() {
  return (
    <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-violet-800 uppercase">
      Shared
    </span>
  );
}

function DocumentRow({
  entry,
  onOpenLinkedItem,
}: {
  entry: DocumentListEntry;
  onOpenLinkedItem?: (itemId: number) => void;
}) {
  const { formatDateTime } = useDisplayFormat();
  const displayName = `${entry.label} · ${entry.fileName}`;
  const itemStyles = entry.itemCategory
    ? CATEGORY_STYLES[entry.itemCategory]
    : null;
  const ItemIcon = entry.itemCategory
    ? getCategoryIcon(entry.itemCategory)
    : FileText;

  return (
    <li className="rounded-xl border border-stone-200 bg-stone-50 px-3 py-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
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
            <span className="rounded-full bg-stone-200 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-stone-700 uppercase">
              {documentCategoryLabel(entry.category)}
            </span>
            {entry.isShared ? <SharedBadge /> : null}
          </div>
          <p className="mt-1 text-xs text-stone-500">
            Linked to: {entry.coversTravellers.join(", ")}
          </p>
          <p className="mt-0.5 text-xs text-stone-400">
            Uploaded {formatDateTime(entry.createdAt)}
          </p>
        </div>

        {entry.itemId && onOpenLinkedItem ? (
          <button
            type="button"
            onClick={() => onOpenLinkedItem(entry.itemId!)}
            className={[
              "inline-flex max-w-full shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm transition hover:bg-white",
              itemStyles?.border ?? "border-stone-200",
              itemStyles?.text ?? "text-stone-700",
            ].join(" ")}
          >
            <span
              className={[
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                itemStyles?.bg ?? "bg-stone-100",
              ].join(" ")}
            >
              <ItemIcon className="h-4 w-4" />
            </span>
            <span className="min-w-0">
              <span className="block text-[10px] font-semibold tracking-wide uppercase opacity-70">
                {entry.itemCategory
                  ? CATEGORY_META[entry.itemCategory].shortLabel
                  : "Item"}
              </span>
              <span className="block truncate font-medium">{entry.itemTitle}</span>
            </span>
          </button>
        ) : (
          <div className="rounded-xl border border-dashed border-stone-300 bg-white px-3 py-2 text-xs text-stone-500">
            Not linked to an item
          </div>
        )}
      </div>
    </li>
  );
}

function SectionHeader({
  title,
  count,
  icon,
}: {
  title: string;
  count: number;
  icon?: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex items-center gap-2">
      {icon}
      <h2 className="font-serif text-lg text-brand-deep">{title}</h2>
      <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-600">
        {count}
      </span>
    </div>
  );
}

function ViewModeTabs({
  value,
  onChange,
}: {
  value: DocumentViewMode;
  onChange: (mode: DocumentViewMode) => void;
}) {
  const tabs: { id: DocumentViewMode; label: string }[] = [
    { id: "item_type", label: "By item type" },
    { id: "document_category", label: "By category" },
    { id: "user", label: "By user" },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={[
            "rounded-xl border px-3 py-2 text-sm font-medium transition",
            value === tab.id
              ? "border-brand-deep bg-brand-deep text-white"
              : "border-stone-200 bg-white text-stone-700 hover:bg-stone-50",
          ].join(" ")}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export function DocumentsPanelContent({
  onOpenLinkedItem,
  manageMode = false,
}: {
  onOpenLinkedItem?: (itemId: number) => void;
  manageMode?: boolean;
}) {
  const [documents, setDocuments] = useState<DocumentListEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<DocumentViewMode>("item_type");
  const [showUpload, setShowUpload] = useState(false);

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

  const groupedByItemType = useMemo(() => {
    const map = new Map<string, DocumentListEntry[]>();
    for (const entry of documents) {
      const key = entry.itemCategory ?? "standalone";
      const list = map.get(key) ?? [];
      list.push(entry);
      map.set(key, list);
    }
    return map;
  }, [documents]);

  const groupedByCategory = useMemo(() => {
    const map = new Map<string, DocumentListEntry[]>();
    for (const entry of documents) {
      const list = map.get(entry.category) ?? [];
      list.push(entry);
      map.set(entry.category, list);
    }
    return map;
  }, [documents]);

  const groupedByUser = useMemo(() => {
    const map = new Map<string, DocumentListEntry[]>();
    for (const entry of documents) {
      for (const traveller of entry.coversTravellers) {
        const list = map.get(traveller) ?? [];
        list.push(entry);
        map.set(traveller, list);
      }
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [documents]);

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

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <ViewModeTabs value={viewMode} onChange={setViewMode} />
        {manageMode ? (
          <button
            type="button"
            onClick={() => setShowUpload((current) => !current)}
            className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-medium text-brand-deep shadow-sm hover:bg-stone-50"
          >
            <Plus className="h-4 w-4" />
            {showUpload ? "Cancel upload" : "Upload document"}
          </button>
        ) : null}
      </div>

      {manageMode && showUpload ? (
        <DocumentUploadForm
          onCancel={() => setShowUpload(false)}
          onSuccess={() => {
            setShowUpload(false);
            void refresh();
          }}
        />
      ) : null}

      {documents.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-stone-300 bg-white/60 p-10 text-center text-stone-500">
          No documents are visible for your account yet.
        </div>
      ) : viewMode === "item_type" ? (
        <div className="space-y-8">
          {[...groupedByItemType.entries()]
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, entries]) => {
              const category = key === "standalone" ? null : (key as Category);
              const styles = category ? CATEGORY_STYLES[category] : null;
              const Icon = category ? getCategoryIcon(category) : FileText;
              const title =
                key === "standalone"
                  ? "Not linked to an item"
                  : CATEGORY_META[category!].label;

              return (
                <section key={key}>
                  <SectionHeader
                    title={title}
                    count={entries.length}
                    icon={
                      <span
                        className={[
                          "flex h-8 w-8 items-center justify-center rounded-lg",
                          styles?.bg ?? "bg-stone-100",
                          styles?.text ?? "text-stone-600",
                        ].join(" ")}
                      >
                        <Icon className="h-4 w-4" />
                      </span>
                    }
                  />
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
            })}
        </div>
      ) : viewMode === "document_category" ? (
        <div className="space-y-8">
          {[...groupedByCategory.entries()]
            .sort(([a], [b]) =>
              documentCategoryLabel(a).localeCompare(documentCategoryLabel(b)),
            )
            .map(([category, entries]) => (
              <section key={category}>
                <SectionHeader
                  title={documentCategoryLabel(category)}
                  count={entries.length}
                />
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
            ))}
        </div>
      ) : (
        <div className="space-y-8">
          {groupedByUser.map(([username, entries]) => (
            <section key={username}>
              <SectionHeader
                title={username}
                count={entries.length}
                icon={<Users className="h-5 w-5 text-stone-500" />}
              />
              <ul className="space-y-2">
                {entries.map((entry) => (
                  <DocumentRow
                    key={`${username}-${entry.id}`}
                    entry={entry}
                    onOpenLinkedItem={onOpenLinkedItem}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

export function DocumentsPanel() {
  const { openItem } = useItineraryUI();
  return <DocumentsPanelContent onOpenLinkedItem={openItem} />;
}

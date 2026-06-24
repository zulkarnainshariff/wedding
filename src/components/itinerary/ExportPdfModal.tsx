"use client";

import { useState } from "react";
import { Download, X } from "lucide-react";
import { generateItineraryPdf, type ExportOptions } from "@/lib/pdf-export";
import { CATEGORIES, CATEGORY_META, type Category } from "@/lib/types";
import type { ItineraryDay, ItineraryItem } from "@/lib/schema";

type Props = {
  open: boolean;
  onClose: () => void;
};

const DEFAULT_CATEGORIES = [...CATEGORIES];

export function ExportPdfModal({ open, onClose }: Props) {
  const [selected, setSelected] = useState<Category[]>(DEFAULT_CATEGORIES);
  const [groupByDay, setGroupByDay] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  function toggleCategory(category: Category) {
    setSelected((current) =>
      current.includes(category)
        ? current.filter((c) => c !== category)
        : [...current, category],
    );
  }

  async function handleExport() {
    setExporting(true);
    setError(null);
    try {
      const [daysRes, itemsRes] = await Promise.all([
        fetch("/api/days"),
        fetch("/api/items"),
      ]);

      if (!daysRes.ok || !itemsRes.ok) {
        throw new Error("Could not load itinerary data.");
      }

      const days: ItineraryDay[] = await daysRes.json();
      const items: ItineraryItem[] = await itemsRes.json();

      const options: ExportOptions = {
        categories: selected,
        groupByDay,
      };

      await generateItineraryPdf(days, items, options);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
      role="presentation"
    >
      <div className="absolute inset-0 bg-stone-900/45 backdrop-blur-[2px]" />

      <div
        className="relative w-full max-w-md rounded-2xl border border-stone-200 bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-pdf-title"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2
              id="export-pdf-title"
              className="font-serif text-xl text-[#1e3a5f]"
            >
              Export to PDF
            </h2>
            <p className="mt-1 text-sm text-stone-500">
              Choose what to include in your itinerary PDF.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-stone-400 hover:bg-stone-100"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-5 space-y-2">
          <p className="text-xs font-semibold tracking-wide text-stone-400 uppercase">
            Categories
          </p>
          {CATEGORIES.map((category) => (
            <label
              key={category}
              className="flex cursor-pointer items-center gap-3 rounded-xl border border-stone-200 px-3 py-2.5 hover:bg-stone-50"
            >
              <input
                type="checkbox"
                checked={selected.includes(category)}
                onChange={() => toggleCategory(category)}
                className="h-4 w-4 rounded border-stone-300"
              />
              <span className="text-sm text-stone-800">
                {CATEGORY_META[category].plural}
              </span>
            </label>
          ))}
        </div>

        <label className="mt-4 flex cursor-pointer items-center gap-3 rounded-xl border border-stone-200 px-3 py-2.5 hover:bg-stone-50">
          <input
            type="checkbox"
            checked={groupByDay}
            onChange={(e) => setGroupByDay(e.target.checked)}
            className="h-4 w-4 rounded border-stone-300"
          />
          <span className="text-sm text-stone-800">
            Organise by day (timeline view)
          </span>
        </label>

        {error && (
          <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="mt-6 flex gap-2">
          <button
            type="button"
            disabled={exporting || selected.length === 0}
            onClick={handleExport}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#1e3a5f] px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            {exporting ? "Exporting…" : "Download PDF"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-stone-200 px-4 py-2.5 text-sm text-stone-600"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export function ExportPdfButton({
  compact = false,
  inline = false,
  onOpen,
}: {
  compact?: boolean;
  inline?: boolean;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={[
        "flex items-center gap-2 text-sm font-medium text-stone-600 transition hover:text-[#1e3a5f]",
        inline
          ? "rounded-lg border border-stone-200 bg-white px-3 py-2 hover:border-[#1e3a5f]/30"
          : [
              "gap-3 rounded-xl px-3 py-2.5 hover:bg-stone-100 hover:text-stone-900",
              compact ? "justify-center px-2" : "w-full",
            ].join(" "),
      ].join(" ")}
      title={compact ? "Export PDF" : undefined}
    >
      <Download className="h-4 w-4 shrink-0 text-stone-400" />
      {!compact && <span>Export PDF</span>}
    </button>
  );
}

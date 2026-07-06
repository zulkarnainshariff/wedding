"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Download, Eye, X } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  buildItineraryPdfBlob,
  downloadItineraryPdf,
  itineraryPdfFilename,
  type ExportOptions,
} from "@/lib/pdf-export";
import { DEFAULT_USER_PREFERENCES } from "@/lib/user-preferences";
import { CATEGORIES, getLegacyCategoryMeta, type Category } from "@/lib/types";
import type { ItineraryDay, ItineraryItem } from "@/lib/schema";

type Props = {
  open: boolean;
  onClose: () => void;
};

const DEFAULT_CATEGORIES = [...CATEGORIES];

export function ExportPdfModal({ open, onClose }: Props) {
  const { user } = useAuth();
  const [selected, setSelected] = useState<Category[]>(DEFAULT_CATEGORIES);
  const [groupByDay, setGroupByDay] = useState(true);
  const [step, setStep] = useState<"options" | "preview">("options");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);

  useEffect(() => {
    if (!open) {
      setStep("options");
      setError(null);
      setPreviewBlob(null);
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
      }
    }
  }, [open, previewUrl]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  if (!open) return null;

  function toggleCategory(category: Category) {
    setSelected((current) =>
      current.includes(category)
        ? current.filter((c) => c !== category)
        : [...current, category],
    );
  }

  async function loadData(): Promise<{ days: ItineraryDay[]; items: ItineraryItem[] }> {
    const [daysRes, itemsRes] = await Promise.all([
      fetch("/api/days"),
      fetch("/api/items"),
    ]);

    if (!daysRes.ok || !itemsRes.ok) {
      throw new Error("Could not load itinerary data.");
    }

    return {
      days: await daysRes.json(),
      items: await itemsRes.json(),
    };
  }

  async function handlePreview() {
    setBusy(true);
    setError(null);
    try {
      const { days, items } = await loadData();
      const options: ExportOptions = {
        categories: selected,
        groupByDay,
        preferences: user?.preferences ?? DEFAULT_USER_PREFERENCES,
      };
      const blob = await buildItineraryPdfBlob(days, items, options);

      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewBlob(blob);
      setPreviewUrl(URL.createObjectURL(blob));
      setStep("preview");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Preview failed.");
    } finally {
      setBusy(false);
    }
  }

  function handleDownload() {
    if (!previewBlob) return;
    downloadItineraryPdf(previewBlob, itineraryPdfFilename());
    onClose();
  }

  function handleBack() {
    setStep("options");
    setError(null);
  }

  const isPreview = step === "preview";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
      role="presentation"
    >
      <div className="absolute inset-0 bg-stone-900/45 backdrop-blur-[2px]" />

      <div
        className={[
          "relative flex max-h-[92vh] w-full flex-col rounded-2xl border border-stone-200 bg-white shadow-xl",
          isPreview ? "max-w-5xl" : "max-w-md",
        ].join(" ")}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-pdf-title"
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-stone-100 px-6 py-5">
          <div>
            <h2
              id="export-pdf-title"
              className="font-serif text-xl text-brand-deep"
            >
              {isPreview ? "Preview PDF" : "Export to PDF"}
            </h2>
            <p className="mt-1 text-sm text-stone-500">
              {isPreview
                ? "Review the layout, then download when you're happy with it."
                : "Choose what to include, preview the layout, then download."}
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

        {isPreview ? (
          <div className="min-h-0 flex-1 overflow-hidden px-6 py-4">
            {previewUrl ? (
              <iframe
                title="Itinerary PDF preview"
                src={previewUrl}
                className="h-[min(70vh,720px)] w-full rounded-xl border border-stone-200 bg-stone-50"
              />
            ) : null}
          </div>
        ) : (
          <div className="overflow-y-auto px-6 py-4">
            <div className="space-y-2">
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
                    {getLegacyCategoryMeta(category)?.plural ?? category}
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
                Organise daily schedule by day
              </span>
            </label>
          </div>
        )}

        {error && (
          <p className="mx-6 mb-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="flex shrink-0 gap-2 border-t border-stone-100 px-6 py-4">
          {isPreview ? (
            <>
              <button
                type="button"
                onClick={handleBack}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-stone-200 px-4 py-2.5 text-sm text-stone-600"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>
              <button
                type="button"
                disabled={busy || !previewBlob}
                onClick={() => void handlePreview()}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-stone-200 px-4 py-2.5 text-sm text-stone-700 disabled:opacity-50"
              >
                <Eye className="h-4 w-4" />
                {busy ? "Refreshing…" : "Refresh preview"}
              </button>
              <button
                type="button"
                disabled={!previewBlob}
                onClick={handleDownload}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-deep px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
              >
                <Download className="h-4 w-4" />
                Download PDF
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                disabled={busy || selected.length === 0}
                onClick={() => void handlePreview()}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-deep px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
              >
                <Eye className="h-4 w-4" />
                {busy ? "Generating preview…" : "Preview PDF"}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-stone-200 px-4 py-2.5 text-sm text-stone-600"
              >
                Cancel
              </button>
            </>
          )}
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
        "flex cursor-pointer items-center gap-2 text-sm font-medium text-stone-600 transition hover:text-brand-deep",
        inline
          ? "rounded-lg border border-stone-200 bg-white px-3 py-2 hover:border-brand-deep/30"
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

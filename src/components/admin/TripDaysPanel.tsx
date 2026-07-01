"use client";

import { useLayoutEffect, useMemo, useRef, useState, useEffect } from "react";
import { Save } from "lucide-react";
import { useToast } from "@/components/ui/ToastProvider";
import { SectionShell } from "@/components/layout/PageShell";
import { useDisplayFormat } from "@/hooks/useDisplayFormat";
import { adminDayRowId, adminDayEditSectionId, scrollToDaySection, scrollToElementById } from "@/lib/day-jump";
import type { ItineraryDay } from "@/lib/schema";

const EMPTY_DAY_FORM = {
  title: "",
  notes: "",
  hidden: false,
};

export function TripDaysPanel({
  initialDays,
  initialItems,
  tripStartDate,
  tripEndDate,
  onDaysChanged,
}: {
  initialDays: ItineraryDay[];
  initialItems: { dayId: number | null }[];
  tripStartDate: string | null;
  tripEndDate: string | null;
  onDaysChanged?: () => void | Promise<void>;
}) {
  const toast = useToast();
  const { formatDateOnlyWithWeekday, formatDateOnly } = useDisplayFormat();
  const [startDate, setStartDate] = useState(tripStartDate ?? "");
  const [endDate, setEndDate] = useState(tripEndDate ?? "");
  const [batchStartDate, setBatchStartDate] = useState(tripStartDate ?? "");
  const [batchEndDate, setBatchEndDate] = useState(tripEndDate ?? "");
  const [days, setDays] = useState(initialDays);
  const [editingDayId, setEditingDayId] = useState<number | null>(null);
  const [dayForm, setDayForm] = useState(EMPTY_DAY_FORM);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const editSectionRef = useRef<HTMLDivElement>(null);
  const [scrollToDayId, setScrollToDayId] = useState<number | null>(null);

  useEffect(() => {
    setDays(initialDays);
  }, [initialDays]);

  const itemCounts = useMemo(() => {
    const counts = new Map<number, number>();
    for (const item of initialItems) {
      if (item.dayId == null) continue;
      counts.set(item.dayId, (counts.get(item.dayId) ?? 0) + 1);
    }
    return counts;
  }, [initialItems]);

  const daysWithCounts = useMemo(
    () =>
      [...days].sort((a, b) => a.date.localeCompare(b.date)),
    [days],
  );

  async function refreshDays() {
    const response = await fetch("/api/days");
    if (response.ok) {
      setDays(await response.json());
    }
    await onDaysChanged?.();
  }

  async function generateDays() {
    if (!startDate || !endDate) {
      toast.error("Choose a start and end date.");
      return;
    }
    setBusy(true);
    setStatus(null);
    try {
      const response = await fetch("/api/days/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startDate, endDate }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        created?: number;
      };
      if (!response.ok) {
        const message = payload.error ?? "Could not generate days.";
        setStatus(message);
        toast.error(message);
        return;
      }
      const message =
        (payload.created ?? 0) > 0
          ? `Added ${payload.created} missing day(s). Use Renumber days to fix day numbers.`
          : "All days in that range are already present.";
      setStatus(message);
      toast.success(message);
      await refreshDays();
    } finally {
      setBusy(false);
    }
  }

  async function renumberDays() {
    setBusy(true);
    setStatus(null);
    try {
      const response = await fetch("/api/days/renumber", { method: "POST" });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        updated?: number;
        total?: number;
      };
      if (!response.ok) {
        const message = payload.error ?? "Could not renumber days.";
        setStatus(message);
        toast.error(message);
        return;
      }
      const message = `Renumbered ${payload.total ?? 0} day(s) in date order (Day 1 through Day ${payload.total ?? 0}).`;
      setStatus(message);
      toast.success(message);
      await refreshDays();
    } finally {
      setBusy(false);
    }
  }

  const editingDay = useMemo(
    () => days.find((entry) => entry.id === editingDayId) ?? null,
    [days, editingDayId],
  );

  async function saveDay() {
    if (!editingDayId || !editingDay) return;
    setBusy(true);
    setStatus(null);
    try {
      const response = await fetch(`/api/days/${editingDayId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dayNumber: editingDay.dayNumber,
          date: editingDay.date,
          title: dayForm.title || null,
          notes: dayForm.notes || null,
          hidden: dayForm.hidden,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        const message = payload.error ?? "Failed to save day.";
        setStatus(message);
        toast.error(message);
        return;
      }

      const saved = (await response.json()) as ItineraryDay;
      setDays((current) =>
        current.map((entry) => (entry.id === saved.id ? saved : entry)),
      );
      setEditingDayId(null);
      setDayForm(EMPTY_DAY_FORM);
      setScrollToDayId(saved.id);
      setStatus("Day saved.");
      toast.success("Day saved.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleHidden(day: ItineraryDay) {
    setBusy(true);
    const response = await fetch(`/api/days/${day.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dayNumber: day.dayNumber,
        date: day.date,
        title: day.title,
        notes: day.notes,
        hidden: !day.hidden,
      }),
    });
    setBusy(false);
    if (!response.ok) {
      toast.error("Could not update day visibility.");
      return;
    }
    const saved = (await response.json()) as ItineraryDay;
    setDays((current) =>
      current.map((entry) => (entry.id === saved.id ? saved : entry)),
    );
  }

  async function batchSetVisibility(hidden: boolean) {
    if (!batchStartDate || !batchEndDate) {
      toast.error("Choose a start and end date for the batch update.");
      return;
    }
    const action = hidden ? "hide" : "unhide";
    if (
      !confirm(
        `${hidden ? "Hide" : "Unhide"} all days from ${formatDateOnly(batchStartDate)} to ${formatDateOnly(batchEndDate)}?`,
      )
    ) {
      return;
    }

    setBusy(true);
    setStatus(null);
    try {
      const response = await fetch("/api/days/visibility", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startDate: batchStartDate,
          endDate: batchEndDate,
          hidden,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        updated?: number;
      };
      if (!response.ok) {
        const message = payload.error ?? `Could not ${action} days in range.`;
        setStatus(message);
        toast.error(message);
        return;
      }
      const count = payload.updated ?? 0;
      const message = `${hidden ? "Hidden" : "Unhid"} ${count} day(s).`;
      setStatus(message);
      toast.success(message);
      await refreshDays();
    } finally {
      setBusy(false);
    }
  }

  function startEdit(day: ItineraryDay) {
    setEditingDayId(day.id);
    setDayForm({
      title: day.title ?? "",
      notes: day.notes ?? "",
      hidden: day.hidden,
    });
    requestAnimationFrame(() => {
      scrollToElementById(adminDayEditSectionId());
    });
  }

  useLayoutEffect(() => {
    if (!editingDayId) return;
    const frame = requestAnimationFrame(() => {
      scrollToElementById(adminDayEditSectionId());
    });
    return () => cancelAnimationFrame(frame);
  }, [editingDayId]);

  useLayoutEffect(() => {
    if (scrollToDayId == null) return;
    const dayId = scrollToDayId;
    const frame = requestAnimationFrame(() => {
      scrollToDaySection(adminDayRowId(dayId));
      setScrollToDayId(null);
    });
    return () => cancelAnimationFrame(frame);
  }, [scrollToDayId, days]);

  return (
    <div className="space-y-6">
      {status ? (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {status}
        </p>
      ) : null}

      <SectionShell title="Trip date range">
        <p className="mb-4 text-sm text-stone-500">
          Generate creates any missing calendar days between start and end. It does
          not change day numbers — use Renumber days after adding or removing days.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block text-stone-500">Start date</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded-lg border border-stone-200 px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-stone-500">End date</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full rounded-lg border border-stone-200 px-3 py-2"
            />
          </label>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void generateDays()}
            className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-brand-deep px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            Generate days
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void renumberDays()}
            className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-700 disabled:opacity-50"
          >
            Renumber days
          </button>
        </div>
      </SectionShell>

      <SectionShell title="Batch hide / unhide">
        <p className="mb-4 text-sm text-stone-500">
          Hide or show all itinerary days within a date range. This applies to
          everyone viewing the trip (not just your personal day filters).
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block text-stone-500">From</span>
            <input
              type="date"
              value={batchStartDate}
              onChange={(e) => setBatchStartDate(e.target.value)}
              className="w-full rounded-lg border border-stone-200 px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-stone-500">To</span>
            <input
              type="date"
              value={batchEndDate}
              onChange={(e) => setBatchEndDate(e.target.value)}
              className="w-full rounded-lg border border-stone-200 px-3 py-2"
            />
          </label>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void batchSetVisibility(true)}
            className="cursor-pointer rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 disabled:opacity-50"
          >
            Hide range
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void batchSetVisibility(false)}
            className="cursor-pointer rounded-lg bg-brand-deep px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            Unhide range
          </button>
        </div>
      </SectionShell>

      {editingDayId ? (
        <div
          id={adminDayEditSectionId()}
          ref={editSectionRef}
          className="scroll-mt-24"
        >
        <SectionShell title="Edit day">
          <div className="grid gap-4">
            <label className="block text-sm sm:col-span-2">
              <span className="mb-1 block text-stone-500">
                Title
                {editingDay ? (
                  <span className="font-normal text-stone-400">
                    {" "}
                    · {formatDateOnly(editingDay.date)}
                  </span>
                ) : null}
              </span>
              <input
                value={dayForm.title}
                onChange={(e) => setDayForm({ ...dayForm, title: e.target.value })}
                placeholder="Optional — leave blank for a free day"
                className="w-full rounded-lg border border-stone-200 px-3 py-2"
              />
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="mb-1 block text-stone-500">Notes</span>
              <textarea
                value={dayForm.notes}
                onChange={(e) => setDayForm({ ...dayForm, notes: e.target.value })}
                rows={2}
                className="w-full rounded-lg border border-stone-200 px-3 py-2"
              />
            </label>
            <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={dayForm.hidden}
                onChange={(e) =>
                  setDayForm({ ...dayForm, hidden: e.target.checked })
                }
              />
              <span>Hidden from itinerary for everyone</span>
            </label>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void saveDay()}
              className="rounded-lg bg-brand-deep px-4 py-2 text-sm font-medium text-white"
            >
              Save day
            </button>
            <button
              type="button"
              onClick={() => {
                setEditingDayId(null);
                setDayForm(EMPTY_DAY_FORM);
              }}
              className="rounded-lg border border-stone-200 px-4 py-2 text-sm"
            >
              Cancel
            </button>
          </div>
        </SectionShell>
        </div>
      ) : null}

      <SectionShell title="All days">
        {daysWithCounts.length === 0 ? (
          <p className="text-sm text-stone-500">
            No days yet. Set a date range and click Generate days.
          </p>
        ) : (
          <div className="divide-y divide-stone-100">
            {daysWithCounts.map((day) => {
              const itemCount = itemCounts.get(day.id) ?? 0;
              const untouched = itemCount === 0 && !day.title?.trim() && !day.notes?.trim();
              const free = itemCount === 0;
              return (
                <div
                  key={day.id}
                  id={adminDayRowId(day.id)}
                  className="scroll-mt-24 flex flex-wrap items-center justify-between gap-3 py-3"
                >
                  <div>
                    <p className="font-medium text-stone-800">
                      Day {day.dayNumber} · {day.title || (untouched ? "Blank day" : free ? "Free day" : "Untitled")}
                    </p>
                    <p className="text-sm text-stone-500">
                      {formatDateOnlyWithWeekday(day.date)}
                      {day.hidden ? " · Hidden" : ""}
                      {untouched ? " · Blank" : free ? " · No items" : ` · ${itemCount} item(s)`}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-stone-600">
                      <input
                        type="checkbox"
                        checked={day.hidden}
                        disabled={busy}
                        onChange={() => void toggleHidden(day)}
                      />
                      Hidden
                    </label>
                    <button
                      type="button"
                      onClick={() => startEdit(day)}
                      className="cursor-pointer rounded-lg border border-stone-200 px-3 py-1.5 text-sm"
                    >
                      Edit
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SectionShell>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { subscribeSyncUpdated } from "@/lib/sync-client";
import type { ItemTaskSummary } from "@/lib/task-queries";
import { TaskNoteIcon } from "@/components/tasks/TaskNoteIcon";

type TaskIndicators = {
  dayCounts: Record<number, number>;
  itemCounts: Record<number, number>;
  itemSummaries: Record<number, ItemTaskSummary>;
};

export function useTaskIndicators() {
  const [indicators, setIndicators] = useState<TaskIndicators>({
    dayCounts: {},
    itemCounts: {},
    itemSummaries: {},
  });

  const refresh = () => {
    void fetch("/api/tasks/indicators")
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (data) {
          setIndicators({
            dayCounts: data.dayCounts ?? {},
            itemCounts: data.itemCounts ?? {},
            itemSummaries: data.itemSummaries ?? {},
          });
        }
      })
      .catch(() => undefined);
  };

  useEffect(() => {
    refresh();
    const onTasksChanged = () => refresh();
    window.addEventListener("tasks-changed", onTasksChanged);
    const unsubscribeSync = subscribeSyncUpdated(() => refresh());
    const interval = window.setInterval(refresh, 30000);
    return () => {
      window.removeEventListener("tasks-changed", onTasksChanged);
      unsubscribeSync();
      window.clearInterval(interval);
    };
  }, []);

  return indicators;
}

export function TaskIndicatorBadge({ count }: { count: number }) {
  if (!count) return null;
  return (
    <span
      className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-100 px-1.5 text-[10px] font-semibold text-amber-800"
      title={`${count} open task${count === 1 ? "" : "s"}`}
    >
      {count}
    </span>
  );
}

export function ItemTaskIndicator({
  summary,
}: {
  summary?: ItemTaskSummary;
}) {
  if (!summary?.count) return null;
  return (
    <span className="inline-flex max-w-full flex-wrap items-center gap-1">
      <span
        className={[
          "inline-flex max-w-full items-center rounded-full px-2 py-0.5 text-[10px] font-medium ring-1",
          summary.hasUrgent
            ? "bg-red-50 text-red-800 ring-red-200"
            : summary.mine > 0
              ? "bg-amber-50 text-amber-900 ring-amber-200"
              : "bg-sky-50 text-sky-900 ring-sky-200",
        ].join(" ")}
        title={summary.label}
      >
        {summary.label}
      </span>
      {summary.hasNotes && summary.notePreview ? (
        <TaskNoteIcon preview={summary.notePreview} />
      ) : null}
    </span>
  );
}

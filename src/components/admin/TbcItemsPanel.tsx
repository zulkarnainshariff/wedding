"use client";

import { useMemo } from "react";
import { CATEGORY_META, type Category } from "@/lib/types";
import { CATEGORY_STYLES, getCategoryIcon } from "@/lib/category-ui";
import { getItemTbcReason } from "@/lib/item-tbc";
import { getItemSortTime } from "@/lib/item-schedule-datetime";
import { useDisplayFormat } from "@/hooks/useDisplayFormat";
import type { ItineraryDay, ItineraryItem } from "@/lib/schema";

export function TbcItemsPanel({
  items,
  days,
  onEdit,
}: {
  items: ItineraryItem[];
  days: ItineraryDay[];
  onEdit: (item: ItineraryItem) => void;
}) {
  const { formatDateOnly, formatWallClockDateTime } = useDisplayFormat();
  const dayById = useMemo(
    () => new Map(days.map((day) => [day.id, day])),
    [days],
  );

  const sortedItems = useMemo(
    () =>
      [...items].sort((left, right) => {
        const leftTime = getItemSortTime(left);
        const rightTime = getItemSortTime(right);
        if (leftTime !== rightTime) return leftTime - rightTime;
        return left.title.localeCompare(right.title);
      }),
    [items],
  );

  if (sortedItems.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-stone-300 bg-white/60 p-10 text-center text-stone-500">
        No itinerary items are marked TBC or not booked yet.
      </div>
    );
  }

  return (
    <div className="divide-y divide-stone-100 rounded-2xl border border-stone-200 bg-white">
      {sortedItems.map((item) => {
        const category = item.category as Category;
        const styles = CATEGORY_STYLES[category] ?? CATEGORY_STYLES.activity;
        const Icon = getCategoryIcon(category);
        const reason = getItemTbcReason(item);
        const day = item.dayId ? dayById.get(item.dayId) : undefined;
        const dateLabel =
          item.eventDate ?? day?.date
            ? formatDateOnly(item.eventDate ?? day?.date)
            : null;

        return (
          <div
            key={item.id}
            className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex min-w-0 items-start gap-3">
              <span
                className={[
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                  styles.bg,
                  styles.text,
                ].join(" ")}
              >
                <Icon className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="truncate font-medium text-stone-800">{item.title}</p>
                <p className="mt-0.5 text-sm text-stone-500">
                  {CATEGORY_META[category]?.label ?? item.category}
                  {dateLabel ? ` · ${dateLabel}` : ""}
                  {item.startDatetime
                    ? ` · ${formatWallClockDateTime(item.startDatetime)}`
                    : ""}
                </p>
                {reason ? (
                  <p className="mt-1 text-xs font-medium text-amber-800">{reason}</p>
                ) : null}
              </div>
            </div>
            <button
              type="button"
              onClick={() => onEdit(item)}
              className="shrink-0 self-start rounded-lg border border-stone-200 px-3 py-1.5 text-sm sm:self-center"
            >
              Edit
            </button>
          </div>
        );
      })}
    </div>
  );
}

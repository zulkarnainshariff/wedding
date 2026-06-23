import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { CATEGORY_STYLES, getCategoryIcon } from "@/lib/category-ui";
import {
  CATEGORY_META,
  formatDateTime,
  isCategory,
  type Category,
} from "@/lib/types";
import type { ItineraryItem } from "@/lib/schema";

export function ItemCard({ item }: { item: ItineraryItem }) {
  const category = isCategory(item.category) ? item.category : "flight";
  const styles = CATEGORY_STYLES[category];
  const Icon = getCategoryIcon(category);

  return (
    <Link
      href={`/itinerary/item/${item.id}`}
      className={[
        "group block rounded-2xl border bg-white p-4 shadow-sm transition-all",
        "hover:-translate-y-0.5 hover:border-[#1e3a5f]/20 hover:shadow-md",
        styles.border,
      ].join(" ")}
    >
      <div className="flex items-start gap-3">
        <div
          className={[
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
            styles.bg,
            styles.text,
          ].join(" ")}
        >
          <Icon className="h-5 w-5" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[11px] font-semibold tracking-wide text-stone-400 uppercase">
                {CATEGORY_META[category as Category]?.label ?? item.category}
              </p>
              <h3 className="mt-0.5 font-medium text-stone-900 group-hover:text-[#1e3a5f]">
                {item.title}
              </h3>
            </div>
            <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-stone-300 group-hover:text-[#d4a853]" />
          </div>

          {item.summary && (
            <p className="mt-1 text-sm text-stone-500">{item.summary}</p>
          )}

          {item.startDatetime && (
            <p className="mt-2 text-xs text-stone-400">
              {formatDateTime(item.startDatetime)}
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}

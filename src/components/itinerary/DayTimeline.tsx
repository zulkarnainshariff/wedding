import { ItemCard } from "./ItemCard";
import { formatDate } from "@/lib/types";
import type { ItineraryDay, ItineraryItem } from "@/lib/schema";

type DayWithItems = ItineraryDay & { items: ItineraryItem[] };

export function DayTimeline({ days }: { days: DayWithItems[] }) {
  if (days.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-stone-300 bg-white/60 p-10 text-center text-stone-500">
        No itinerary days yet. Add days and items from the Manage page.
      </div>
    );
  }

  return (
    <div className="relative space-y-10">
      {days.map((day) => (
        <section key={day.id} id={`day-${day.dayNumber}`}>
          <div className="sticky top-0 z-10 mb-4 flex items-center gap-3 bg-[#f5f1eb]/90 py-2 backdrop-blur">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#1e3a5f] text-sm font-bold text-[#d4a853]">
              {day.dayNumber}
            </div>
            <div>
              <h2 className="font-serif text-xl text-[#1e3a5f]">
                {day.title || `Day ${day.dayNumber}`}
              </h2>
              <p className="text-sm text-stone-500">{formatDate(day.date)}</p>
            </div>
          </div>

          {day.notes && (
            <p className="mb-4 text-sm text-stone-500">{day.notes}</p>
          )}

          {day.items.length === 0 ? (
            <p className="rounded-xl border border-dashed border-stone-200 bg-white/50 px-4 py-6 text-sm text-stone-400">
              No items scheduled for this day.
            </p>
          ) : (
            <div className="relative space-y-3 pl-5 before:absolute before:top-2 before:bottom-2 before:left-[7px] before:w-px before:bg-[#d4a853]/40">
              {day.items.map((item) => (
                <div key={item.id} className="relative">
                  <span className="absolute top-6 -left-5 h-2.5 w-2.5 rounded-full border-2 border-white bg-[#d4a853]" />
                  <ItemCard item={item} />
                </div>
              ))}
            </div>
          )}
        </section>
      ))}
    </div>
  );
}

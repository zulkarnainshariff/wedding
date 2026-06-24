"use client";

import { useTripTime } from "@/components/itinerary/TripTimeContext";
import { ViewModeToggle } from "@/components/itinerary/ViewModeToggle";

export function ScheduleToolbar() {
  const { hidePast, setHidePast } = useTripTime();

  return (
    <div className="mb-6 flex flex-wrap items-center gap-3">
      <ViewModeToggle />
      <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm shadow-sm">
        <input
          type="checkbox"
          checked={hidePast}
          onChange={(event) => void setHidePast(event.target.checked)}
          className="h-4 w-4 rounded border-stone-300"
        />
        <span className="font-medium text-stone-700">Hide past days</span>
      </label>
    </div>
  );
}

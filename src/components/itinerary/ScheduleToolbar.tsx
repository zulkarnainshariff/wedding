"use client";

import { useTripTime } from "@/components/itinerary/TripTimeContext";
import { ViewModeToggle } from "@/components/itinerary/ViewModeToggle";
import { ParticipantFilterDropdown } from "@/components/itinerary/ParticipantFilterDropdown";
import { DayJumpSelector } from "@/components/itinerary/DayJumpSelector";
import type { DayJumpTarget, DayJumpVariant } from "@/lib/day-jump";

export function ScheduleToolbar({
  participantOptions,
  selectedParticipants = [],
  onParticipantsChange,
  jumpDays,
  jumpVariant,
}: {
  participantOptions?: string[];
  selectedParticipants?: string[];
  onParticipantsChange?: (value: string[]) => void;
  jumpDays?: DayJumpTarget[];
  jumpVariant?: DayJumpVariant;
}) {
  const { hidePast, setHidePast } = useTripTime();

  return (
    <div className="mb-6 flex flex-wrap items-center gap-3">
      <ViewModeToggle />
      {jumpDays && jumpVariant ? (
        <DayJumpSelector days={jumpDays} variant={jumpVariant} />
      ) : null}
      {participantOptions && onParticipantsChange ? (
        <ParticipantFilterDropdown
          options={participantOptions}
          value={selectedParticipants}
          onChange={onParticipantsChange}
        />
      ) : null}
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

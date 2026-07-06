"use client";

import { ViewModeToggle } from "@/components/itinerary/ViewModeToggle";
import { ParticipantFilterDropdown } from "@/components/itinerary/ParticipantFilterDropdown";
import { DayJumpSelector } from "@/components/itinerary/DayJumpSelector";
import { ItineraryOptionsDropdown } from "@/components/itinerary/ItineraryOptionsDropdown";
import type { DayJumpTarget, DayJumpVariant } from "@/lib/day-jump";

export function ScheduleToolbar({
  participantOptions,
  selectedParticipants = [],
  onParticipantsChange,
  jumpDays,
  jumpVariant,
  showPastDayOption = true,
  showDayFilterOptions = true,
}: {
  participantOptions?: string[];
  selectedParticipants?: string[];
  onParticipantsChange?: (value: string[]) => void;
  jumpDays?: DayJumpTarget[];
  jumpVariant?: DayJumpVariant;
  showPastDayOption?: boolean;
  showDayFilterOptions?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
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
      <ItineraryOptionsDropdown
        showPastDayOption={showPastDayOption}
        showDayFilterOptions={showDayFilterOptions}
      />
    </div>
  );
}

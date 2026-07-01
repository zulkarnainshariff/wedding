"use client";

import { ViewModeToggle } from "@/components/itinerary/ViewModeToggle";
import { ParticipantFilterDropdown } from "@/components/itinerary/ParticipantFilterDropdown";
import { DayJumpSelector } from "@/components/itinerary/DayJumpSelector";
import { ItineraryOptionsDropdown } from "@/components/itinerary/ItineraryOptionsDropdown";
import { FlightDaySortToggle } from "@/components/itinerary/FlightDaySortToggle";
import type { DayJumpTarget, DayJumpVariant } from "@/lib/day-jump";
import type { ItineraryDay, ItineraryItem } from "@/lib/schema";

type DayWithItems = ItineraryDay & { items: ItineraryItem[] };

export function ScheduleToolbar({
  participantOptions,
  selectedParticipants = [],
  onParticipantsChange,
  jumpDays,
  jumpVariant,
  sortDays,
  showPastDayOption = true,
  showDayFilterOptions = true,
}: {
  participantOptions?: string[];
  selectedParticipants?: string[];
  onParticipantsChange?: (value: string[]) => void;
  jumpDays?: DayJumpTarget[];
  jumpVariant?: DayJumpVariant;
  sortDays?: DayWithItems[];
  showPastDayOption?: boolean;
  showDayFilterOptions?: boolean;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-center gap-3">
      <ViewModeToggle />
      {sortDays ? <FlightDaySortToggle days={sortDays} /> : null}
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

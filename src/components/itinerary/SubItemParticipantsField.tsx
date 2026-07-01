"use client";

import { CheckboxDropdown } from "@/components/admin/CheckboxDropdown";
import { IconTooltip } from "@/components/ui/IconTooltip";
import { useTravellerOptions } from "@/hooks/useTravellerOptions";
import { participantsMatchParent } from "@/lib/item-subitems";

const SAME_AS_PARENT_TOOLTIP =
  "Use the same participants as the parent itinerary item. Uncheck to choose different people for this sub-item.";

const COPY_FROM_PARENT_TOOLTIP =
  "Copy the parent item's participants into this sub-item once. You can still edit the list afterward.";

export function SubItemParticipantsField({
  participants,
  onChange,
  parentParticipants,
}: {
  participants: string[];
  onChange: (participants: string[]) => void;
  parentParticipants: string[];
}) {
  const participantOptions = useTravellerOptions(participants);
  const canCopyFromParent = parentParticipants.length > 0;
  const sameAsParent = participantsMatchParent(participants, parentParticipants);

  return (
    <div className="text-sm sm:col-span-2">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <span className="text-stone-500">Participants</span>
        {canCopyFromParent ? (
          <div className="flex flex-wrap items-center gap-3">
            <IconTooltip label={SAME_AS_PARENT_TOOLTIP}>
              <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-stone-600">
                <input
                  type="checkbox"
                  checked={sameAsParent}
                  onChange={(event) => {
                    if (event.target.checked) {
                      onChange([...parentParticipants]);
                    }
                  }}
                  className="rounded border-stone-300"
                />
                Same as parent item
              </label>
            </IconTooltip>
            {!sameAsParent ? (
              <IconTooltip label={COPY_FROM_PARENT_TOOLTIP}>
                <button
                  type="button"
                  onClick={() => onChange([...parentParticipants])}
                  className="text-xs font-medium text-brand-deep hover:underline"
                >
                  Copy from parent item
                </button>
              </IconTooltip>
            ) : null}
          </div>
        ) : null}
      </div>
      <CheckboxDropdown
        options={participantOptions}
        value={participants}
        onChange={onChange}
        emptyLabel="Select participants…"
      />
    </div>
  );
}

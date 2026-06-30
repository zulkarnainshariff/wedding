"use client";

import { ChevronDown, SlidersHorizontal } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTripTime } from "@/components/itinerary/TripTimeContext";
import { useAnchoredDropdownPosition } from "@/hooks/useAnchoredDropdownPosition";
import { useDropdownDismiss } from "@/hooks/useDropdownDismiss";

export function ItineraryOptionsDropdown({
  showPastDayOption = true,
  showDayFilterOptions = true,
}: {
  showPastDayOption?: boolean;
  showDayFilterOptions?: boolean;
}) {
  const {
    hidePast,
    setHidePast,
    hideFreeDays,
    setHideFreeDays,
    hideUntouchedDays,
    setHideUntouchedDays,
  } = useTripTime();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuStyle = useAnchoredDropdownPosition(open, triggerRef, {
    minWidth: 280,
    maxHeight: 280,
  });

  useEffect(() => setMounted(true), []);
  useDropdownDismiss(open, () => setOpen(false), triggerRef, menuRef);

  if (!showPastDayOption && !showDayFilterOptions) return null;

  const activeCount =
    (showPastDayOption && hidePast ? 1 : 0) +
    (showDayFilterOptions && hideFreeDays ? 1 : 0) +
    (showDayFilterOptions && hideUntouchedDays ? 1 : 0);

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm shadow-sm"
      >
        <SlidersHorizontal className="h-4 w-4 text-stone-400" />
        <span className="font-medium text-stone-700">
          Options{activeCount > 0 ? ` (${activeCount})` : ""}
        </span>
        <ChevronDown
          className={[
            "h-4 w-4 text-stone-400 transition-transform",
            open ? "rotate-180" : "",
          ].join(" ")}
        />
      </button>

      {open && mounted
        ? createPortal(
            <div
              ref={menuRef}
              style={menuStyle}
              className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-xl"
            >
              <div className="space-y-3 p-3">
                {showPastDayOption ? (
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={hidePast}
                      onChange={(event) => void setHidePast(event.target.checked)}
                      className="h-4 w-4 rounded border-stone-300"
                    />
                    <span className="font-medium text-stone-700">Hide past days</span>
                  </label>
                ) : null}
                {showDayFilterOptions ? (
                  <>
                    <label className="flex cursor-pointer items-start gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={hideFreeDays}
                        onChange={(event) =>
                          void setHideFreeDays(event.target.checked)
                        }
                        className="mt-0.5 h-4 w-4 rounded border-stone-300"
                      />
                      <span>
                        <span className="block font-medium text-stone-700">
                          Hide free days
                        </span>
                        <span className="mt-0.5 block text-xs text-stone-500">
                          Days with nothing scheduled
                        </span>
                      </span>
                    </label>
                    <label className="flex cursor-pointer items-start gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={hideUntouchedDays}
                        onChange={(event) =>
                          void setHideUntouchedDays(event.target.checked)
                        }
                        className="mt-0.5 h-4 w-4 rounded border-stone-300"
                      />
                      <span>
                        <span className="block font-medium text-stone-700">
                          Hide blank days
                        </span>
                        <span className="mt-0.5 block text-xs text-stone-500">
                          Generated days with no title, notes, or items
                        </span>
                      </span>
                    </label>
                  </>
                ) : null}
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

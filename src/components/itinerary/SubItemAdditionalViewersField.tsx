"use client";

import { useMemo } from "react";
import { AdditionalViewersDropdown } from "@/components/admin/AdditionalViewersDropdown";
import { IconTooltip } from "@/components/ui/IconTooltip";
import { additionalViewerOptions } from "@/lib/item-viewers";
import type { ViewerLinks } from "@/lib/item-viewer-links";
import {
  additionalViewersMatchParent,
  copyParentAdditionalViewers,
} from "@/lib/item-subitems";
import type { ItineraryItem } from "@/lib/schema";

const SAME_AS_PARENT_VIEWERS_TOOLTIP =
  "Use the same additional viewers and participant links as the parent item. Uncheck to manage this sub-item separately.";

const COPY_FROM_PARENT_VIEWERS_TOOLTIP =
  "Copy the parent item's additional viewers and participant links into this sub-item once. You can still edit them afterward.";

export function SubItemAdditionalViewersField({
  parentItem,
  participants,
  viewers,
  viewerLinks,
  onChange,
  accountUsernames,
}: {
  parentItem?: ItineraryItem | null;
  participants: string[];
  viewers: string[];
  viewerLinks: ViewerLinks;
  onChange: (next: { viewers: string[]; viewerLinks: ViewerLinks }) => void;
  accountUsernames: string[];
}) {
  const parentAdditionalViewers = useMemo(
    () => (parentItem ? copyParentAdditionalViewers(parentItem) : null),
    [parentItem],
  );
  const viewerOptions = useMemo(
    () => additionalViewerOptions(participants, viewers, accountUsernames),
    [participants, viewers, accountUsernames],
  );
  const canCopyFromParent = Boolean(parentAdditionalViewers?.viewers.length);
  const sameAsParent = Boolean(
    parentAdditionalViewers &&
      additionalViewersMatchParent(
        viewers,
        viewerLinks,
        parentAdditionalViewers.viewers,
        parentAdditionalViewers.viewerLinks,
      ),
  );

  return (
    <div className="text-sm sm:col-span-2">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <span className="text-stone-500">Additional viewers</span>
        {canCopyFromParent ? (
          <div className="flex flex-wrap items-center gap-3">
            <IconTooltip label={SAME_AS_PARENT_VIEWERS_TOOLTIP}>
              <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-stone-600">
                <input
                  type="checkbox"
                  checked={sameAsParent}
                  onChange={(event) => {
                    if (event.target.checked && parentItem) {
                      onChange(copyParentAdditionalViewers(parentItem));
                    }
                  }}
                  className="rounded border-stone-300"
                />
                Same as parent item
              </label>
            </IconTooltip>
            {!sameAsParent ? (
              <IconTooltip label={COPY_FROM_PARENT_VIEWERS_TOOLTIP}>
                <button
                  type="button"
                  onClick={() =>
                    parentItem && onChange(copyParentAdditionalViewers(parentItem))
                  }
                  className="text-xs font-medium text-brand-deep hover:underline"
                >
                  Copy from parent item
                </button>
              </IconTooltip>
            ) : null}
          </div>
        ) : null}
      </div>
      <AdditionalViewersDropdown
        options={viewerOptions}
        viewers={viewers}
        viewerLinks={viewerLinks}
        participantOptions={participants}
        onChange={onChange}
        emptyLabel="No additional viewers"
      />
      <p className="mt-1 text-xs text-stone-500">
        People who should see this sub-item but are not listed as participants
        (for example travellers being picked up).
      </p>
    </div>
  );
}

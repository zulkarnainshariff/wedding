"use client";

import { CheckboxDropdown } from "@/components/admin/CheckboxDropdown";
import { pruneViewerLinks, type ViewerLinks } from "@/lib/item-viewer-links";
import { normalizeTravellerName } from "@/lib/travellers";

export function ViewerLinksFields({
  viewers,
  viewerLinks,
  participantOptions,
  onChange,
}: {
  viewers: string[];
  viewerLinks: ViewerLinks;
  participantOptions: string[];
  onChange: (links: ViewerLinks) => void;
}) {
  if (viewers.length === 0 || participantOptions.length === 0) {
    return null;
  }

  return (
    <div className="mt-3 space-y-3 border-t border-stone-200 pt-3">
      <p className="text-xs font-medium text-stone-600">View linked to</p>
      {viewers.map((viewer) => {
        const key = normalizeTravellerName(viewer);
        return (
          <CheckboxDropdown
            key={key}
            label={viewer}
            options={participantOptions}
            value={viewerLinks[key] ?? []}
            onChange={(linkedTo) =>
              onChange({
                ...viewerLinks,
                [key]: linkedTo,
              })
            }
            emptyLabel="Select participant(s)…"
          />
        );
      })}
    </div>
  );
}

export function updateViewersWithLinks(
  viewers: string[],
  viewerLinks: ViewerLinks,
): ViewerLinks {
  return pruneViewerLinks(viewers, viewerLinks);
}

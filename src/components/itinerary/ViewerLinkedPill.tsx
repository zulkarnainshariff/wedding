"use client";

import { useAuth } from "@/components/auth/AuthProvider";
import { viewerLinkLabel } from "@/lib/item-viewer-links";
import { getViewerLinkedParticipantsForUser } from "@/lib/item-viewer-links";
import type { ItineraryItem } from "@/lib/schema";

export function ViewerLinkedPill({ item }: { item: ItineraryItem }) {
  const { user } = useAuth();
  if (!user) return null;

  const linked = getViewerLinkedParticipantsForUser(item, user);
  const label = linked ? viewerLinkLabel(linked) : null;
  if (!label) return null;

  return (
    <span
      className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-800"
      title={`Viewing for ${label}`}
    >
      {label}
    </span>
  );
}

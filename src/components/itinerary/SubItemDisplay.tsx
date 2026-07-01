"use client";

import { MapPin } from "lucide-react";
import { useDisplayFormat } from "@/hooks/useDisplayFormat";
import { getItemLocation } from "@/lib/item-location";
import { getSubItemTimeLabel } from "@/lib/item-subitem-utils";
import {
  extractSubItemParticipants,
  extractSubItemViewers,
} from "@/lib/item-subitems";
import { ViewerLinkedPill } from "@/components/itinerary/ViewerLinkedPill";
import type { ItineraryItem } from "@/lib/schema";
import { itemSectionId } from "@/lib/day-jump";

function SubItemTime({
  subItem,
  formatClockTime,
}: {
  subItem: ItineraryItem;
  formatClockTime: (time: string | null | undefined) => string;
}) {
  const raw = getSubItemTimeLabel(subItem);
  if (!raw) return null;

  const formatted = /^\d{2}:\d{2}$/.test(raw)
    ? formatClockTime(raw)
    : raw;

  return (
    <span className="shrink-0 text-xs font-semibold tracking-wide text-accent uppercase">
      {formatted}
    </span>
  );
}

function SubItemPeopleMeta({
  participants,
  viewers,
  compact = false,
}: {
  participants: string[];
  viewers: string[];
  compact?: boolean;
}) {
  if (participants.length === 0 && viewers.length === 0) return null;

  return (
    <div
      className={[
        "space-y-0.5 text-stone-500",
        compact ? "text-[11px]" : "text-xs",
      ].join(" ")}
    >
      {participants.length > 0 && (
        <p>Participants: {participants.join(", ")}</p>
      )}
      {viewers.length > 0 && (
        <p>Also visible to: {viewers.join(", ")}</p>
      )}
    </div>
  );
}

export function SubItemRow({
  subItem,
  compact = false,
  onClick,
}: {
  subItem: ItineraryItem;
  compact?: boolean;
  onClick?: () => void;
}) {
  const { formatClockTime } = useDisplayFormat();
  const location = getItemLocation(subItem.details as Record<string, unknown>);
  const participants = extractSubItemParticipants(subItem.details);
  const viewers = extractSubItemViewers(subItem.details);
  const description =
    subItem.summary ||
    (typeof subItem.details === "object" &&
    subItem.details &&
    "description" in subItem.details
      ? String((subItem.details as { description?: string }).description ?? "")
      : "");

  const content = (
    <>
      <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2 gap-y-1">
        <SubItemTime subItem={subItem} formatClockTime={formatClockTime} />
        <p
          className={[
            "font-medium text-stone-800",
            compact ? "text-sm" : "",
          ].join(" ")}
        >
          {subItem.title}
        </p>
        <ViewerLinkedPill item={subItem} />
      </div>
      {location?.mapLink && (
        <a
          href={location.mapLink}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(event) => event.stopPropagation()}
          className="inline-flex shrink-0 items-center gap-1 text-xs text-brand-deep underline decoration-accent/60"
          title={location.name ?? "Open in Google Maps"}
        >
          <MapPin className="h-3.5 w-3.5" />
          {location.name ? (
            <span className="max-w-[10rem] truncate">{location.name}</span>
          ) : (
            "Maps"
          )}
        </a>
      )}
    </>
  );

  const peopleMeta = (
    <SubItemPeopleMeta
      participants={participants}
      viewers={viewers}
      compact={compact}
    />
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={[
          "flex w-full flex-col gap-1 rounded-lg text-left transition-colors hover:bg-stone-50",
          compact ? "px-2 py-1.5" : "px-3 py-2",
        ].join(" ")}
      >
        <div className="flex items-start justify-between gap-2">{content}</div>
        {peopleMeta}
      </button>
    );
  }

  return (
    <div
      className={[
        "flex flex-col gap-1",
        compact ? "px-2 py-1.5" : "px-3 py-2",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-2">
        {content}
      </div>
      {peopleMeta}
      {description && !compact && (
        <p className="text-sm text-stone-600">{description}</p>
      )}
    </div>
  );
}

export function SubItemCascade({
  subItems,
  onSubItemClick,
}: {
  subItems: ItineraryItem[];
  onSubItemClick?: (id: number) => void;
}) {
  if (subItems.length === 0) return null;

  return (
    <div className="border-t border-stone-100 px-4 pb-4 pt-3">
      <p className="mb-2 text-[11px] font-semibold tracking-wide text-stone-400 uppercase">
        {subItems.length} sub-item{subItems.length === 1 ? "" : "s"}
      </p>
      <div className="space-y-0.5 border-l-2 border-accent/40 pl-3">
        {subItems.map((subItem) => (
          <div key={subItem.id} id={itemSectionId(subItem.id)} className="scroll-mt-24">
            <SubItemRow
              subItem={subItem}
              compact
              onClick={
                onSubItemClick ? () => onSubItemClick(subItem.id) : undefined
              }
            />
          </div>
        ))}
      </div>
    </div>
  );
}

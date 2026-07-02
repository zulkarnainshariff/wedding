"use client";

import { MapPin } from "lucide-react";
import { useDisplayFormat } from "@/hooks/useDisplayFormat";
import { getItemLocation } from "@/lib/item-location";
import { isItemCompleted } from "@/lib/item-completion";
import { getSubItemTimeLabel } from "@/lib/item-subitem-utils";
import {
  extractSubItemParticipants,
  extractSubItemViewers,
} from "@/lib/item-subitems";
import { useAuth } from "@/components/auth/AuthProvider";
import { ViewerLinkedPill } from "@/components/itinerary/ViewerLinkedPill";
import { canSeeItemAdditionalViewers } from "@/lib/item-viewers";
import { ItemTaskIcon } from "@/components/itinerary/ItemTaskIcon";
import {
  ItemCompleteToggle,
  ItemDoneBadge,
} from "@/components/itinerary/ItemCompleteToggle";
import type { ItineraryItem } from "@/lib/schema";
import type { ItemTaskSummary } from "@/lib/task-queries";
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
  showViewers = true,
  compact = false,
}: {
  participants: string[];
  viewers: string[];
  showViewers?: boolean;
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
      {showViewers && viewers.length > 0 && (
        <p>Also visible to: {viewers.join(", ")}</p>
      )}
    </div>
  );
}

export function SubItemRow({
  subItem,
  compact = false,
  onClick,
  taskSummary,
}: {
  subItem: ItineraryItem;
  compact?: boolean;
  onClick?: () => void;
  taskSummary?: ItemTaskSummary;
}) {
  const { user } = useAuth();
  const { formatClockTime } = useDisplayFormat();
  const location = getItemLocation(subItem.details as Record<string, unknown>);
  const participants = extractSubItemParticipants(subItem.details);
  const viewers = extractSubItemViewers(subItem.details);
  const showViewers = canSeeItemAdditionalViewers(subItem, user);
  const completed = isItemCompleted(subItem);
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
            "font-medium",
            compact ? "text-sm" : "",
            completed
              ? "text-stone-500 line-through decoration-emerald-600/40"
              : "text-stone-800",
          ].join(" ")}
        >
          {subItem.title}
        </p>
        {completed ? <ItemDoneBadge /> : null}
        <ItemTaskIcon summary={taskSummary} />
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
      showViewers={showViewers}
      compact={compact}
    />
  );

  if (onClick) {
    return (
      <div
        className={[
          "flex items-start gap-2 rounded-lg transition-colors hover:bg-stone-50",
          compact ? "px-2 py-1.5" : "px-3 py-2",
        ].join(" ")}
      >
        <div className="shrink-0 pt-0.5">
          <ItemCompleteToggle item={subItem} compact />
        </div>
        <button
          type="button"
          onClick={onClick}
          className="min-w-0 flex-1 text-left"
        >
          <div className="flex items-start justify-between gap-2">{content}</div>
          {peopleMeta}
        </button>
      </div>
    );
  }

  return (
    <div
      className={[
        "flex items-start gap-2",
        compact ? "px-2 py-1.5" : "px-3 py-2",
      ].join(" ")}
    >
      <div className="shrink-0 pt-0.5">
        <ItemCompleteToggle item={subItem} compact />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">{content}</div>
        {peopleMeta}
        {description && !compact && (
          <p className="text-sm text-stone-600">{description}</p>
        )}
      </div>
    </div>
  );
}

export function SubItemCascade({
  subItems,
  onSubItemClick,
  itemSummaries = {},
}: {
  subItems: ItineraryItem[];
  onSubItemClick?: (id: number) => void;
  itemSummaries?: Record<number, ItemTaskSummary>;
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
              taskSummary={itemSummaries[subItem.id]}
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

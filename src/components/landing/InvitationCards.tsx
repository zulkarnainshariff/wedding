"use client";

import { useState } from "react";
import type {
  PublicInvitationEvent,
  PublicScheduleItem,
} from "@/lib/invitation-types";
import { FlipInvitationCard } from "./FlipInvitationCard";

export function InvitationCards({
  events,
  centered = true,
}: {
  events: Array<PublicInvitationEvent & { schedule: PublicScheduleItem[] }>;
  centered?: boolean;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);

  const activeEvent = events[activeIndex];

  function selectEvent(index: number) {
    setActiveIndex(index);
    setFlipped(false);
  }

  if (!activeEvent) {
    return <p className="text-muted">Invitation details coming soon.</p>;
  }

  return (
    <div
      className={[
        "flex flex-col px-4",
        centered ? "flex-1 items-center justify-center py-8" : "items-center py-4",
      ].join(" ")}
    >
      {events.length > 1 && (
        <div
          className="mb-8 flex flex-wrap justify-center gap-2"
          role="tablist"
          aria-label="Wedding events"
        >
          {events.map((event, index) => (
            <button
              key={event.id}
              type="button"
              role="tab"
              aria-selected={index === activeIndex}
              onClick={() => selectEvent(index)}
              className={[
                "invitation-event-tab rounded-full px-5 py-2 text-sm font-medium transition",
                index === activeIndex ? "invitation-event-tab--active" : "",
              ].join(" ")}
            >
              {event.name}
            </button>
          ))}
        </div>
      )}

      <FlipInvitationCard
        key={activeEvent.slug}
        event={activeEvent}
        flipped={flipped}
        onFlip={() => setFlipped((current) => !current)}
      />

      <p className="mt-8 max-w-sm text-center text-sm text-muted">
        {events.length > 1
          ? "Choose a celebration above, then tap the card to reveal the day’s schedule."
          : "Tap the card to reveal the day’s schedule."}
      </p>
    </div>
  );
}

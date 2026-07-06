"use client";

import { useRef } from "react";
import { MapPin, RotateCcw } from "lucide-react";
import type {
  PublicInvitationEvent,
  PublicScheduleItem,
} from "@/lib/invitation-types";

function FlipHint({
  label,
  className = "invitation-card-hint",
}: {
  label: string;
  className?: string;
}) {
  return (
    <span
      className={`mt-10 flex items-center justify-center gap-1.5 text-xs tracking-wide uppercase ${className}`}
    >
      <RotateCcw className="h-3.5 w-3.5" />
      {label}
    </span>
  );
}

export function FlipInvitationCard({
  event,
  flipped,
  onFlip,
}: {
  event: PublicInvitationEvent & { schedule: PublicScheduleItem[] };
  flipped: boolean;
  onFlip: () => void;
}) {
  const { cardFront, schedule } = event;
  const mapsOpeningRef = useRef(false);

  function openMaps(url: string, event: React.MouseEvent) {
    event.stopPropagation();
    event.preventDefault();
    if (mapsOpeningRef.current) return;
    mapsOpeningRef.current = true;

    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    window.setTimeout(() => {
      mapsOpeningRef.current = false;
    }, 1000);
  }

  const locationLabel = cardFront.location || cardFront.venue;
  const mapsUrl = cardFront.mapsUrl;

  return (
    <div className="group relative z-10 mx-auto w-full max-w-md text-left">
      <div className="invitation-flip-scene overflow-hidden rounded-3xl">
        <div
          className={[
            "invitation-flip-inner relative min-h-[28rem] w-full transition-transform duration-700",
            flipped ? "[transform:rotateY(180deg)]" : "",
          ].join(" ")}
        >
          <div
            className={[
              "invitation-flip-face invitation-card-face absolute inset-0 flex cursor-pointer flex-col items-center justify-center p-8 text-center shadow-xl [transform:rotateY(0deg)_translateZ(1px)]",
              flipped ? "pointer-events-none invisible" : "",
            ].join(" ")}
            aria-hidden={flipped}
            onClick={flipped ? undefined : onFlip}
            onKeyDown={(keyboardEvent) => {
              if (flipped) return;
              if (keyboardEvent.key === "Enter" || keyboardEvent.key === " ") {
                keyboardEvent.preventDefault();
                onFlip();
              }
            }}
            role="button"
            tabIndex={flipped ? -1 : 0}
          >
            <div className="pointer-events-none absolute inset-4 rounded-2xl border invitation-card-frame" />
            <p className="invitation-card-headline text-xs font-semibold tracking-[0.25em] uppercase">
              {cardFront.headline}
            </p>
            <h2 className="invitation-card-title mt-6 font-serif text-4xl leading-tight md:text-5xl">
              {cardFront.coupleNames}
            </h2>
            {cardFront.tagline && (
              <p className="invitation-card-body mt-4 max-w-xs text-sm leading-relaxed">
                {cardFront.tagline}
              </p>
            )}
            <div className="relative z-20 mt-8 space-y-1">
              <p className="invitation-card-date font-serif text-xl">
                {cardFront.dateLine}
              </p>
              {cardFront.venue && cardFront.venue !== locationLabel && (
                <p className="invitation-card-body text-sm">{cardFront.venue}</p>
              )}
              {mapsUrl && locationLabel ? (
                <button
                  type="button"
                  onClick={(event) => openMaps(mapsUrl, event)}
                  className="invitation-card-body inline-flex items-center justify-center gap-1 text-sm underline decoration-white/40 underline-offset-2 hover:text-white hover:decoration-white"
                >
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  {locationLabel}
                </button>
              ) : (
                <>
                  {cardFront.venue && (
                    <p className="invitation-card-body text-sm">{cardFront.venue}</p>
                  )}
                  {cardFront.location && (
                    <p className="invitation-card-body-muted text-sm">
                      {cardFront.location}
                    </p>
                  )}
                </>
              )}
            </div>
            <FlipHint label="Tap to view schedule" />
          </div>

          <div
            className={[
              "invitation-flip-face invitation-card-back absolute inset-0 flex cursor-pointer flex-col p-8 text-left shadow-xl [transform:rotateY(180deg)_translateZ(1px)]",
              flipped ? "" : "pointer-events-none invisible",
            ].join(" ")}
            aria-hidden={!flipped}
            onClick={flipped ? onFlip : undefined}
            onKeyDown={(keyboardEvent) => {
              if (!flipped) return;
              if (keyboardEvent.key === "Enter" || keyboardEvent.key === " ") {
                keyboardEvent.preventDefault();
                onFlip();
              }
            }}
            role="button"
            tabIndex={flipped ? 0 : -1}
          >
            <p className="text-xs font-semibold tracking-[0.2em] text-accent uppercase">
              Order of events
            </p>
            <h3 className="mt-2 font-serif text-2xl text-brand-deep">
              {event.name}
            </h3>
            <p className="mt-1 text-sm text-muted">{cardFront.dateLine}</p>

            <ol className="mt-6 flex-1 space-y-4 overflow-y-auto">
              {schedule.map((item) => (
                <li key={item.id} className="flex gap-4">
                  <span className="w-28 shrink-0 text-sm font-medium text-accent">
                    {item.timeLabel}
                  </span>
                  <div>
                    <p className="font-medium text-foreground">{item.title}</p>
                    {item.description && (
                      <p className="mt-0.5 text-sm text-muted">
                        {item.description}
                      </p>
                    )}
                  </div>
                </li>
              ))}
              {schedule.length === 0 && (
                <li className="text-sm text-muted">
                  Schedule details coming soon.
                </li>
              )}
            </ol>

            <FlipHint label="Tap to view invitation" className="text-muted" />
          </div>
        </div>
      </div>
    </div>
  );
}

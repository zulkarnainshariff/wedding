"use client";

import { useRef } from "react";
import { MapPin, RotateCcw } from "lucide-react";
import type {
  PublicInvitationEvent,
  PublicScheduleItem,
} from "@/lib/invitation-types";

function FlipHint({
  label,
  className = "text-white/50",
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
    <div className="group relative mx-auto w-full max-w-md text-left">
      <div className="[perspective:1200px]">
        <div
          className={[
            "relative min-h-[28rem] w-full transition-transform duration-700 [transform-style:preserve-3d]",
            flipped ? "[transform:rotateY(180deg)]" : "",
          ].join(" ")}
        >
          <div
            className={[
              "absolute inset-0 flex cursor-pointer flex-col items-center justify-center rounded-3xl border border-[#d4a853]/30 bg-gradient-to-br from-[#1e3a5f] via-[#254a75] to-[#1e3a5f] p-8 text-center shadow-xl [backface-visibility:hidden]",
              flipped ? "pointer-events-none" : "",
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
            <div className="pointer-events-none absolute inset-4 rounded-2xl border border-[#d4a853]/25" />
            <p className="text-xs font-semibold tracking-[0.25em] text-[#d4a853] uppercase">
              {cardFront.headline}
            </p>
            <h2 className="mt-6 font-serif text-4xl leading-tight text-white md:text-5xl">
              {cardFront.coupleNames}
            </h2>
            {cardFront.tagline && (
              <p className="mt-4 max-w-xs text-sm leading-relaxed text-white/75">
                {cardFront.tagline}
              </p>
            )}
            <div className="relative z-20 mt-8 space-y-1">
              <p className="font-serif text-xl text-[#d4a853]">
                {cardFront.dateLine}
              </p>
              {cardFront.venue && cardFront.venue !== locationLabel && (
                <p className="text-sm text-white/85">{cardFront.venue}</p>
              )}
              {mapsUrl && locationLabel ? (
                <button
                  type="button"
                  onClick={(event) => openMaps(mapsUrl, event)}
                  className="inline-flex items-center justify-center gap-1 text-sm text-white/85 underline decoration-white/40 underline-offset-2 hover:text-white hover:decoration-white"
                >
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  {locationLabel}
                </button>
              ) : (
                <>
                  {cardFront.venue && (
                    <p className="text-sm text-white/85">{cardFront.venue}</p>
                  )}
                  {cardFront.location && (
                    <p className="text-sm text-white/65">{cardFront.location}</p>
                  )}
                </>
              )}
            </div>
            <FlipHint label="Tap to view schedule" className="text-white/50" />
          </div>

          <div
            className={[
              "absolute inset-0 flex cursor-pointer flex-col rounded-3xl border border-stone-200 bg-white p-8 text-left shadow-xl [backface-visibility:hidden] [transform:rotateY(180deg)]",
              flipped ? "" : "pointer-events-none",
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
            <p className="text-xs font-semibold tracking-[0.2em] text-[#d4a853] uppercase">
              Order of events
            </p>
            <h3 className="mt-2 font-serif text-2xl text-[#1e3a5f]">
              {event.name}
            </h3>
            <p className="mt-1 text-sm text-stone-500">{cardFront.dateLine}</p>

            <ol className="mt-6 flex-1 space-y-4 overflow-y-auto">
              {schedule.map((item) => (
                <li key={item.id} className="flex gap-4">
                  <span className="w-28 shrink-0 text-sm font-medium text-[#d4a853]">
                    {item.timeLabel}
                  </span>
                  <div>
                    <p className="font-medium text-stone-800">{item.title}</p>
                    {item.description && (
                      <p className="mt-0.5 text-sm text-stone-500">
                        {item.description}
                      </p>
                    )}
                  </div>
                </li>
              ))}
              {schedule.length === 0 && (
                <li className="text-sm text-stone-400">
                  Schedule details coming soon.
                </li>
              )}
            </ol>

            <FlipHint label="Tap to view invitation" className="text-stone-400" />
          </div>
        </div>
      </div>
    </div>
  );
}

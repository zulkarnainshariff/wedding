"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  RSVP_STATUS_LABELS,
  type RsvpStatus,
} from "@/lib/guest-list-types";

type RsvpData = {
  guest: {
    label: string;
    allowIncludeFamily: boolean;
    expectedHeadcount: number;
    rsvpStatus: RsvpStatus;
    rsvpAttendingCount: number | null;
    rsvpNotes: string | null;
    members: { id: number; name: string }[];
  };
  event: {
    name: string;
    eventDate: string;
    location: string | null;
  };
  rsvpSettings: {
    contactName: string | null;
    contactPhone: string | null;
    contactEmail: string | null;
  } | null;
  expired: boolean;
};

function clampAttendingCount(value: number, max: number) {
  return Math.min(Math.max(1, value), max);
}

function RsvpContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [data, setData] = useState<RsvpData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<RsvpStatus>("not_responded");
  const [attendingCount, setAttendingCount] = useState(1);
  const [memberNames, setMemberNames] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const maxGuests = data?.guest.expectedHeadcount ?? 1;

  useEffect(() => {
    if (!token) {
      setError("This RSVP link is invalid.");
      setLoading(false);
      return;
    }

    void fetch(`/api/public/rsvp?token=${encodeURIComponent(token)}`)
      .then(async (response) => {
        if (!response.ok) {
          setError("This RSVP link is invalid or has expired.");
          return;
        }
        const payload = (await response.json()) as RsvpData;
        setData(payload);
        setStatus(payload.guest.rsvpStatus);
        const initialCount = clampAttendingCount(
          payload.guest.rsvpAttendingCount ?? payload.guest.expectedHeadcount,
          payload.guest.expectedHeadcount,
        );
        setAttendingCount(initialCount);
        setMemberNames(
          payload.guest.members.length > 0
            ? payload.guest.members.map((member) => member.name)
            : [""],
        );
        setNotes(payload.guest.rsvpNotes ?? "");
      })
      .catch(() => setError("Unable to load RSVP."))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    if (status !== "attending") return;
    setMemberNames((current) => {
      if (current.length > attendingCount) {
        return current.slice(0, attendingCount);
      }
      if (current.length === 0) return [""];
      return current;
    });
  }, [attendingCount, status]);

  function setAttendingCountClamped(next: number) {
    if (!data) return;
    setAttendingCount(clampAttendingCount(next, data.guest.expectedHeadcount));
  }

  async function submit() {
    if (!token) return;
    setSaving(true);
    setError(null);
    const response = await fetch(
      `/api/public/rsvp?token=${encodeURIComponent(token)}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rsvpStatus: status,
          rsvpAttendingCount: status === "attending" ? attendingCount : 0,
          rsvpNotes: notes || null,
          memberNames: memberNames.filter(Boolean).slice(0, attendingCount),
        }),
      },
    );
    setSaving(false);
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      setError(payload.error ?? "Unable to save RSVP.");
      return;
    }
    setSaved(true);
  }

  if (loading) {
    return <p className="text-stone-500">Loading your invitation…</p>;
  }

  if (!data) {
    return <p className="text-red-600">{error ?? "Invitation not found."}</p>;
  }

  if (data.expired) {
    const contact = data.rsvpSettings;
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-8 shadow-sm">
        <h1 className="font-serif text-2xl text-brand-deep">RSVP closed</h1>
        <p className="mt-3 text-stone-600">
          The RSVP deadline for {data.event.name} has passed. Please contact:
        </p>
        {contact?.contactName && (
          <p className="mt-4 font-medium text-stone-800">{contact.contactName}</p>
        )}
        {contact?.contactPhone && (
          <p className="text-stone-600">{contact.contactPhone}</p>
        )}
        {contact?.contactEmail && (
          <p className="text-stone-600">{contact.contactEmail}</p>
        )}
      </div>
    );
  }

  const showNames =
    status === "attending" &&
    (data.guest.allowIncludeFamily || data.guest.members.length > 0);

  const namesToShow =
    memberNames.slice(0, attendingCount).length > 0
      ? memberNames.slice(0, attendingCount)
      : [""];

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-8 shadow-sm">
      <p className="text-xs font-semibold tracking-[0.2em] text-accent uppercase">
        You&apos;re invited
      </p>
      <h1 className="mt-2 font-serif text-3xl text-brand-deep">{data.event.name}</h1>
      <p className="mt-1 text-stone-500">
        {data.event.eventDate}
        {data.event.location ? ` · ${data.event.location}` : ""}
      </p>
      <p className="mt-4 text-lg text-stone-800">{data.guest.label}</p>

      {saved ? (
        <p className="mt-6 rounded-lg bg-emerald-50 px-4 py-3 text-emerald-700">
          Thank you — your RSVP has been saved.
        </p>
      ) : (
        <div className="mt-6 space-y-4">
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-stone-700">Your response</legend>
            {(["attending", "not_attending", "not_confirmed"] as RsvpStatus[]).map(
              (option) => (
                <label key={option} className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="rsvp"
                    checked={status === option}
                    onChange={() => setStatus(option)}
                  />
                  {RSVP_STATUS_LABELS[option]}
                </label>
              ),
            )}
          </fieldset>

          {status === "attending" && (
            <>
              <p className="text-sm text-stone-500">
                Your invitation allows up to {maxGuests} guest
                {maxGuests === 1 ? "" : "s"}
              </p>

              <label className="block text-sm">
                <span className="mb-1 block text-stone-500">Number attending</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={attendingCount <= 1}
                    onClick={() => setAttendingCountClamped(attendingCount - 1)}
                    className="rounded-lg border border-stone-200 px-3 py-2 text-sm disabled:opacity-40"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    min={1}
                    max={maxGuests}
                    value={attendingCount}
                    onChange={(e) =>
                      setAttendingCountClamped(Number(e.target.value) || 1)
                    }
                    className="w-full rounded-lg border border-stone-200 px-3 py-2"
                  />
                  <button
                    type="button"
                    disabled={attendingCount >= maxGuests}
                    onClick={() => setAttendingCountClamped(attendingCount + 1)}
                    className="rounded-lg border border-stone-200 px-3 py-2 text-sm disabled:opacity-40"
                  >
                    +
                  </button>
                </div>
              </label>

              {showNames && (
                <div className="space-y-2">
                  <p className="text-sm text-stone-500">
                    Names of those attending (optional)
                  </p>
                  {namesToShow.map((name, index) => (
                    <input
                      key={index}
                      value={name}
                      onChange={(e) =>
                        setMemberNames((current) =>
                          current.map((entry, i) =>
                            i === index ? e.target.value : entry,
                          ),
                        )
                      }
                      placeholder="Guest name"
                      className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
                    />
                  ))}
                  {data.guest.allowIncludeFamily &&
                    memberNames.length < attendingCount && (
                      <button
                        type="button"
                        onClick={() => setMemberNames((current) => [...current, ""])}
                        className="text-sm text-brand-deep underline"
                      >
                        Add another name
                      </button>
                    )}
                </div>
              )}
            </>
          )}

          <label className="block text-sm">
            <span className="mb-1 block text-stone-500">Notes (optional)</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-stone-200 px-3 py-2"
            />
          </label>

          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <button
            type="button"
            disabled={saving}
            onClick={() => void submit()}
            className="w-full rounded-xl bg-brand-deep px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
          >
            {saving ? "Saving…" : "Submit RSVP"}
          </button>
        </div>
      )}
    </div>
  );
}

export function RsvpPageContent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-lg">
        <Suspense fallback={<p className="text-center text-stone-500">Loading…</p>}>
          <RsvpContent />
        </Suspense>
      </div>
    </div>
  );
}

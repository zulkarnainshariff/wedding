import {
  buildStructuredDetailsPayload,
  emptyStructuredDetails,
  parseStructuredDetails,
  type StructuredItemDetails,
} from "@/lib/admin-item-details";
import {
  flightFormDatetimes,
  parseStoredClockTime,
  resolveFlightSchedule,
  zonedLocalToUtc,
} from "@/lib/flight-datetime";
import { resolveFlightScheduleForItem } from "@/lib/flight-segment-timing";
import { getAirportTimezone } from "@/lib/airport-timezones";
import { wallClockToDate } from "@/lib/item-schedule-datetime";
import type { Category, FlightSegment } from "@/lib/types";
import type { ItineraryItem } from "@/lib/schema";

export type ItemFormState = {
  id?: number;
  dayId: string;
  category: Category;
  title: string;
  summary: string;
  eventDate: string;
  startDatetime: string;
  endDatetime: string;
  sortOrder: string;
  structured: StructuredItemDetails;
};

export function toDatetimeLocal(value: string | Date | null | undefined): string {
  if (!value) return "";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Parse a datetime-local value in the browser's timezone and return UTC ISO. */
export function datetimeLocalToIso(value: string): string | null {
  if (!value.trim()) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function isoFromDateAndClock(date: string, time?: string): string | null {
  if (!date || !time?.trim()) return null;
  const instant = wallClockToDate(date, time);
  return instant ? instant.toISOString() : null;
}

function formatArrivalTimeValue(date: string | null, clock: string): string {
  if (date) return `${date}T${clock}`;
  return clock;
}

function updateLastFlightSegmentArrival(
  segments: FlightSegment[],
  arrivalTime: string,
): FlightSegment[] {
  if (!segments.length) return segments;

  const next = [...segments];
  for (let index = next.length - 1; index >= 0; index -= 1) {
    const segment = next[index];
    if (segment.transit || !(segment.fromIata || segment.from)) continue;
    next[index] = { ...segment, arrivalTime };
    break;
  }
  return next;
}

function syncStructuredTimes(
  category: Category,
  structured: StructuredItemDetails,
  eventDate: string | null,
  startDatetime: string,
  endDatetime: string,
): {
  structured: StructuredItemDetails;
  eventDate: string | null;
  startIso: string | null;
  endIso: string | null;
} {
  const nextSimple = { ...structured.simple };
  let nextEventDate = eventDate;
  let startIso = datetimeLocalToIso(startDatetime);
  let endIso = datetimeLocalToIso(endDatetime);

  if (category === "flight") {
    const depTz = getAirportTimezone(nextSimple.fromIata);
    const arrTz = getAirportTimezone(nextSimple.toIata);

    if (startDatetime) {
      const [date, time] = startDatetime.split("T");
      if (date) nextEventDate = date;
      if (date && time) {
        const clock = time.slice(0, 5);
        nextSimple.departureTime = clock;
        if (depTz) {
          startIso =
            zonedLocalToUtc(date, clock, depTz)?.toISOString() ?? startIso;
        }
      }
    }

    if (endDatetime) {
      const [date, time] = endDatetime.split("T");
      if (date && time) {
        const clock = time.slice(0, 5);
        nextSimple.arrivalTime = formatArrivalTimeValue(date, clock);
        if (arrTz) {
          endIso = zonedLocalToUtc(date, clock, arrTz)?.toISOString() ?? endIso;
        }
      }
    }

    let nextStructured = structured;
    if (structured.segments.length > 0 && nextSimple.arrivalTime) {
      nextStructured = {
        ...structured,
        segments: updateLastFlightSegmentArrival(
          structured.segments,
          nextSimple.arrivalTime,
        ),
      };
    }

    const flightDetails = {
      ...structured.simple,
      ...nextSimple,
      segments: nextStructured.segments,
    };
    const hasMultiSegment =
      nextStructured.segments.filter(
        (segment) => !segment.transit && (segment.fromIata || segment.from),
      ).length >= 2;

    const resolved = hasMultiSegment
      ? resolveFlightScheduleForItem({
          category: "flight",
          eventDate: nextEventDate ?? null,
          startDatetime: startIso ? new Date(startIso) : null,
          endDatetime: endIso ? new Date(endIso) : null,
          details: flightDetails,
        })
      : resolveFlightSchedule({
          eventDate: nextEventDate,
          startDatetime: startIso,
          endDatetime: endIso,
          details: flightDetails,
        });

    const resolvedArrival = parseStoredClockTime(nextSimple.arrivalTime);

    return {
      structured: { ...nextStructured, simple: nextSimple },
      eventDate: resolved.eventDate ?? nextEventDate,
      startIso:
        resolved.startDatetime?.toISOString() ??
        startIso ??
        (nextEventDate && nextSimple.departureTime
          ? isoFromDateAndClock(nextEventDate, nextSimple.departureTime)
          : null),
      endIso:
        resolved.endDatetime?.toISOString() ??
        endIso ??
        (resolvedArrival?.embeddedDate &&
        resolvedArrival.clock &&
        arrTz
          ? zonedLocalToUtc(
              resolvedArrival.embeddedDate,
              resolvedArrival.clock,
              arrTz,
            )?.toISOString() ?? null
          : nextEventDate && nextSimple.arrivalTime
            ? isoFromDateAndClock(nextEventDate, nextSimple.arrivalTime)
            : null),
    };
  }

  if (category === "car_rental") {
    if (startDatetime) {
      const [date, time] = startDatetime.split("T");
      if (date) nextEventDate = date;
      if (time) nextSimple.pickupTime = time.slice(0, 5);
    } else if (nextEventDate && nextSimple.pickupTime) {
      startIso = isoFromDateAndClock(nextEventDate, nextSimple.pickupTime);
    }

    if (endDatetime) {
      const [, time] = endDatetime.split("T");
      if (time) nextSimple.returnTime = time.slice(0, 5);
    } else if (nextEventDate && nextSimple.returnTime) {
      endIso = isoFromDateAndClock(nextEventDate, nextSimple.returnTime);
    }
  }

  if (category === "accommodation") {
    if (startDatetime) {
      const [date, time] = startDatetime.split("T");
      if (date) nextSimple.checkInDate = date;
      if (time) nextSimple.checkInTime = time.slice(0, 5);
      if (date) nextEventDate = date;
    }
    if (endDatetime) {
      const [date, time] = endDatetime.split("T");
      if (date) nextSimple.checkOutDate = date;
      if (time) nextSimple.checkOutTime = time.slice(0, 5);
    }
  }

  if (category === "activity") {
    if (startDatetime) {
      const [date, time] = startDatetime.split("T");
      if (date) nextEventDate = date;
      if (time) nextSimple.time = time.slice(0, 5);
    } else if (nextEventDate && nextSimple.time) {
      startIso = isoFromDateAndClock(nextEventDate, nextSimple.time);
    }
  }

  if (category === "pet_relocation") {
    if (startDatetime) {
      const [date, time] = startDatetime.split("T");
      if (date) nextEventDate = date;
      if (time) nextSimple.departureTime = time.slice(0, 5);
    }
    if (endDatetime) {
      const [, time] = endDatetime.split("T");
      if (time) nextSimple.arrivalTime = time.slice(0, 5);
    }
  }

  return {
    structured: { ...structured, simple: nextSimple },
    eventDate: nextEventDate,
    startIso,
    endIso,
  };
}

export function emptyItemForm(category: Category = "flight"): ItemFormState {
  return {
    dayId: "",
    category,
    title: "",
    summary: "",
    eventDate: "",
    startDatetime: "",
    endDatetime: "",
    sortOrder: "0",
    structured: emptyStructuredDetails(category),
  };
}

export function itemToForm(item: ItineraryItem): ItemFormState {
  const category = item.category as Category;
  const flightTimes =
    category === "flight" ? flightFormDatetimes(item) : null;

  return {
    id: item.id,
    dayId: item.dayId ? String(item.dayId) : "",
    category,
    title: item.title,
    summary: item.summary ?? "",
    eventDate: item.eventDate ?? "",
    startDatetime: flightTimes?.startDatetime || toDatetimeLocal(item.startDatetime),
    endDatetime: flightTimes?.endDatetime || toDatetimeLocal(item.endDatetime),
    sortOrder: String(item.sortOrder ?? 0),
    structured: parseStructuredDetails(category, item.details as Record<string, unknown>),
  };
}

export function buildItemApiPayload(
  form: ItemFormState,
  existingDetails?: Record<string, unknown> | null,
) {
  const synced = syncStructuredTimes(
    form.category,
    form.structured,
    form.eventDate || null,
    form.startDatetime,
    form.endDatetime,
  );

  let details = buildStructuredDetailsPayload(form.category, synced.structured);

  if (form.category === "flight" && existingDetails) {
    details = preserveLiveDepartureDetails(details, existingDetails);
  }

  return {
    dayId: form.dayId ? Number(form.dayId) : null,
    category: form.category,
    title: form.title.trim(),
    summary: form.summary || null,
    eventDate: synced.eventDate,
    startDatetime: synced.startIso,
    endDatetime: synced.endIso,
    sortOrder: Number(form.sortOrder || 0),
    details,
  };
}

function preserveLiveDepartureDetails(
  payload: Record<string, unknown>,
  existing: Record<string, unknown>,
): Record<string, unknown> {
  const next = { ...payload };

  if (existing.departureTerminal != null && String(existing.departureTerminal).trim()) {
    next.departureTerminal = existing.departureTerminal;
  }
  if (existing.departureGate != null && String(existing.departureGate).trim()) {
    next.departureGate = existing.departureGate;
  }
  if (existing._flightTracking != null) {
    next._flightTracking = existing._flightTracking;
  }

  if (payload.isPrivate == null && existing.isPrivate != null) {
    next.isPrivate = existing.isPrivate;
  }
  if (
    (payload.privateViewers == null ||
      (Array.isArray(payload.privateViewers) &&
        payload.privateViewers.length === 0)) &&
    Array.isArray(existing.privateViewers) &&
    existing.privateViewers.length > 0
  ) {
    next.privateViewers = existing.privateViewers;
  } else if (
    (payload.privateViewers == null ||
      (Array.isArray(payload.privateViewers) &&
        payload.privateViewers.length === 0)) &&
    Array.isArray(existing.extraViewers) &&
    existing.extraViewers.length > 0
  ) {
    next.privateViewers = existing.extraViewers;
  }

  delete next.extraViewers;

  return next;
}

function flightArrivalTimePart(
  endDatetime: string,
  startDatetime: string,
  arrivalTime?: string,
): string {
  const fromEnd = endDatetime.split("T")[1];
  if (fromEnd) return fromEnd.slice(0, 5);
  if (arrivalTime?.trim()) return arrivalTime.slice(0, 5);
  const fromStart = startDatetime.split("T")[1];
  if (fromStart) return fromStart.slice(0, 5);
  return "12:00";
}

/** When departure datetime changes, keep arrival time but align its date if it still matched the old departure date. */
export function applyFlightStartDatetimeChange(
  form: ItemFormState,
  nextStart: string,
): ItemFormState {
  if (form.category !== "flight") {
    return { ...form, startDatetime: nextStart };
  }

  const prevStartDate = form.startDatetime.split("T")[0] ?? "";
  const nextStartDate = nextStart.split("T")[0] ?? "";
  const prevEndDate = form.endDatetime.split("T")[0] ?? "";

  const shouldAlignEndDate =
    !form.endDatetime || (prevStartDate && prevEndDate === prevStartDate);

  const nextEnd =
    shouldAlignEndDate && nextStartDate
      ? `${nextStartDate}T${flightArrivalTimePart(
          form.endDatetime,
          nextStart,
          form.structured.simple.arrivalTime,
        )}`
      : form.endDatetime;

  return { ...form, startDatetime: nextStart, endDatetime: nextEnd };
}

export function copyFlightDepartureDateToArrival(
  form: ItemFormState,
): ItemFormState {
  if (form.category !== "flight" || !form.startDatetime) return form;
  const startDate = form.startDatetime.split("T")[0];
  if (!startDate) return form;
  const time = flightArrivalTimePart(
    form.endDatetime,
    form.startDatetime,
    form.structured.simple.arrivalTime,
  );
  return { ...form, endDatetime: `${startDate}T${time}` };
}

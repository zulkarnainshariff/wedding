import {
  buildStructuredDetailsPayload,
  emptyStructuredDetails,
  parseStructuredDetails,
  type StructuredItemDetails,
} from "@/lib/admin-item-details";
import { flightFormDatetimes, resolveFlightSchedule } from "@/lib/flight-datetime";
import { wallClockToDate } from "@/lib/item-schedule-datetime";
import type { Category } from "@/lib/types";
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
    if (startDatetime) {
      const [date, time] = startDatetime.split("T");
      if (date) nextEventDate = date;
      if (time) nextSimple.departureTime = time.slice(0, 5);
    }
    if (endDatetime) {
      const [, time] = endDatetime.split("T");
      if (time) nextSimple.arrivalTime = time.slice(0, 5);
    }

    const resolved = resolveFlightSchedule({
      eventDate: nextEventDate,
      startDatetime: startIso,
      endDatetime: endIso,
      details: {
        ...structured.simple,
        ...nextSimple,
        departureTime: nextSimple.departureTime,
        arrivalTime: nextSimple.arrivalTime,
      },
    });

    return {
      structured: { ...structured, simple: nextSimple },
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
        (nextEventDate && nextSimple.arrivalTime
          ? isoFromDateAndClock(
              nextEventDate,
              nextSimple.arrivalTime,
            )
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

export function buildItemApiPayload(form: ItemFormState) {
  const synced = syncStructuredTimes(
    form.category,
    form.structured,
    form.eventDate || null,
    form.startDatetime,
    form.endDatetime,
  );

  return {
    dayId: form.dayId ? Number(form.dayId) : null,
    category: form.category,
    title: form.title.trim(),
    summary: form.summary || null,
    eventDate: synced.eventDate,
    startDatetime: synced.startIso,
    endDatetime: synced.endIso,
    sortOrder: Number(form.sortOrder || 0),
    details: buildStructuredDetailsPayload(form.category, synced.structured),
  };
}

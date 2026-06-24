import {
  normalizeGuestText,
  normalizeTravellerList,
} from "./travellers";
import type { ActivityDetails } from "./types";

export type RawActivityLocation = {
  name?: string;
  airportCode?: string;
  mapLink?: string;
  plusCode?: string;
};

export type RawDailyActivity = {
  id: string;
  time?: string | null;
  type: string;
  title: string;
  description?: string;
  participants?: string[] | string;
  location?: RawActivityLocation;
};

export type RawDailyDay = {
  id: string;
  date: string;
  day: string;
  title: string;
  items: RawDailyActivity[];
};

export type ActivityLinkConfig = {
  category: string;
  title: string;
  syncArrivalTime?: boolean;
  syncDepartureTime?: boolean;
};

export const ACTIVITY_LINKS: Record<string, ActivityLinkConfig> = {
  "arrive-phl": {
    category: "flight",
    title: "Australia to Philadelphia",
    syncArrivalTime: true,
  },
  "collect-rental-car": {
    category: "car_rental",
    title: "Enterprise Philadelphia",
  },
  "checkin-lancaster": {
    category: "accommodation",
    title: "VRBO in Lancaster",
  },
  "checkout-lancaster": {
    category: "accommodation",
    title: "VRBO in Lancaster",
  },
  "checkin-glenside": {
    category: "accommodation",
    title: "Airbnb in Glenside",
  },
  "checkout-glenside": {
    category: "accommodation",
    title: "Airbnb in Glenside",
  },
  "collect-rental-car-toronto": {
    category: "car_rental",
    title: "Enterprise Toronto Pearson",
  },
  "fly-to-toronto": {
    category: "flight",
    title: "Philadelphia to Toronto (TBC)",
    syncDepartureTime: true,
  },
  "return-melbourne": {
    category: "flight",
    title: "Toronto to Melbourne",
    syncDepartureTime: true,
  },
  "return-philadelphia": {
    category: "flight",
    title: "Toronto to Philadelphia (TBC)",
    syncDepartureTime: true,
  },
};

export function normalizeParticipants(
  participants?: string[] | string,
): string[] | undefined {
  if (!participants) return undefined;
  if (participants === "All" || participants === "all") {
    return ["Everyone"];
  }
  if (typeof participants === "string") {
    return [normalizeGuestText(participants)];
  }
  return normalizeTravellerList(participants);
}

export function buildActivityDetails(
  raw: RawDailyActivity,
  linkedItemId?: number,
): ActivityDetails {
  return {
    slug: raw.id,
    activityType: raw.type,
    time: raw.time ?? null,
    description: raw.description ? normalizeGuestText(raw.description) : undefined,
    participants: normalizeParticipants(raw.participants),
    location: raw.location
      ? {
          name: raw.location.name
            ? normalizeGuestText(raw.location.name)
            : undefined,
          airportCode: raw.location.airportCode,
          mapLink: raw.location.mapLink,
          plusCode: raw.location.plusCode,
        }
      : undefined,
    linkedItemId,
  };
}

export function buildActivitySummary(raw: RawDailyActivity): string {
  const parts: string[] = [];
  if (raw.time) parts.push(raw.time);
  const participants = normalizeParticipants(raw.participants);
  if (participants?.length) {
    parts.push(participants.join(", "));
  }
  if (raw.description) parts.push(normalizeGuestText(raw.description));
  return parts.join(" · ") || raw.title;
}

export function combineActivityDatetime(
  date: string,
  time: string | null | undefined,
): Date | null {
  if (!time) return null;
  return new Date(`${date}T${time}:00`);
}

export const ACTIVITY_TYPE_LABELS: Record<string, string> = {
  "flight-arrival": "Flight arrival",
  "car-rental": "Car rental",
  accommodation: "Accommodation",
  outing: "Outing",
  task: "Task",
  travel: "Travel",
  arrival: "Arrival",
  parking: "Parking",
  transport: "Transport",
  meal: "Meal",
  "airport-pickup": "Airport pickup",
  appointment: "Appointment",
  ceremony: "Ceremony",
  "official-appointment": "Official appointment",
  "airport-dropoff": "Airport drop-off",
  flight: "Flight",
};

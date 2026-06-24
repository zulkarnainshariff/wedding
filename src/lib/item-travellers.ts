import { normalizeTravellerName } from "./travellers";

function addName(names: Set<string>, value: string) {
  const trimmed = value.trim();
  if (trimmed) names.add(normalizeTravellerName(trimmed));
}

function addNames(names: Set<string>, value: unknown) {
  if (!value) return;

  if (typeof value === "string") {
    addName(names, value);
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((entry) => {
      if (typeof entry === "string") addName(names, entry);
    });
    return;
  }

  if (typeof value === "object") {
    Object.keys(value as Record<string, unknown>).forEach((key) => {
      addName(names, key);
    });
  }
}

export function usernameToTravellerName(username: string): string {
  return username
    .split(/[\s_-]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

export function travellerMatchesUsername(
  traveller: string,
  username: string,
): boolean {
  const normalizedTraveller = normalizeTravellerName(traveller).toLowerCase();
  const normalizedUsername = username.toLowerCase();
  const displayName = usernameToTravellerName(username).toLowerCase();

  return (
    normalizedTraveller === normalizedUsername ||
    normalizedTraveller === displayName ||
    traveller.toLowerCase() === normalizedUsername
  );
}

export function extractItemTravellers(
  details: unknown,
  category: string,
): string[] {
  if (!details || typeof details !== "object") return [];

  const d = details as Record<string, unknown>;
  const names = new Set<string>();

  addNames(names, d.travellers);
  addNames(names, d.passengers);
  addNames(names, d.participants);
  addNames(names, d.guests);
  addNames(names, d.cargoParty);
  addNames(names, d.seats);
  addNames(names, d.baggage);
  addNames(names, d.bookingReferences);

  if (category === "car_rental" && typeof d.driver === "string") {
    addName(names, d.driver);
  }

  return [...names];
}

export function itemIncludesEveryone(travellers: string[]): boolean {
  return travellers.some(
    (name) => name === "Everyone" || name.toLowerCase() === "all",
  );
}

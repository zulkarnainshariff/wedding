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
  if (Array.isArray(d.segments)) {
    for (const segment of d.segments as { seats?: Record<string, unknown> }[]) {
      addNames(names, segment.seats);
    }
  }
  addNames(names, d.bookingReferences);
  if (Array.isArray(d.bookingGroups)) {
    for (const group of d.bookingGroups as { travellers?: string[] }[]) {
      addNames(names, group.travellers);
    }
  }

  if (category === "car_rental" && typeof d.driver === "string") {
    addName(names, d.driver);
  }

  return [...names];
}

export function itemIncludesEveryone(travellers: string[]): boolean {
  return travellers.some(
    (name) => name === EVERYONE_TRAVELLER || name.toLowerCase() === "all",
  );
}

export const EVERYONE_TRAVELLER = "Everyone";

export const SYSTEM_ACCOUNT_USERNAMES = new Set(["root", "admin"]);

export function travellerOptionsFromNames(names: string[]): string[] {
  const options = new Set<string>();

  for (const name of names) {
    const normalized = normalizeTravellerName(name).trim();
    if (!normalized || normalized === EVERYONE_TRAVELLER) continue;
    options.add(normalized);
  }

  return [...options].sort((left, right) => left.localeCompare(right));
}

export function travellerOptionsFromAccounts(
  accountUsernames: string[],
  existing: string[] = [],
): string[] {
  const fromAccounts = accountUsernames
    .map((username) => username.trim().toLowerCase())
    .filter(
      (username) => username && !SYSTEM_ACCOUNT_USERNAMES.has(username),
    )
    .map((username) => usernameToTravellerName(username));

  const options = new Set<string>([
    ...fromAccounts,
    ...existing.map((name) => normalizeTravellerName(name)).filter(Boolean),
    EVERYONE_TRAVELLER,
  ]);

  return [...options].sort((left, right) => {
    if (left === EVERYONE_TRAVELLER) return 1;
    if (right === EVERYONE_TRAVELLER) return -1;
    return left.localeCompare(right);
  });
}

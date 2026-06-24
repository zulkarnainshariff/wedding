import { formatTravellerLabel } from "./types";

export function formatSeatsSummary(
  seats: Record<string, string | null> | undefined,
  passengers?: string[],
): string {
  const assigned = seats
    ? Object.entries(seats).filter(([, seat]) => seat != null && seat !== "")
    : [];

  if (assigned.length > 0) {
    return assigned
      .map(([name, seat]) => `${formatTravellerLabel(name)}: ${seat}`)
      .join(" · ");
  }

  if (passengers && passengers.length > 0) {
    return passengers.map((name) => `${formatTravellerLabel(name)}: —`).join(" · ");
  }

  return "Not assigned yet";
}

export function hasAssignedSeats(
  seats: Record<string, string | null> | undefined,
): boolean {
  if (!seats) return false;
  return Object.values(seats).some((seat) => seat != null && seat !== "");
}

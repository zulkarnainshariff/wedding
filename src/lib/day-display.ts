import type { SessionUser } from "@/lib/permissions";

export function hasRestrictedTravellerView(user: SessionUser | null): boolean {
  if (!user || user.isAdmin) return false;
  return user.permissions.viewTravellers !== "all";
}

export function getDayDisplayTitle(
  day: { title?: string | null; dayNumber: number },
  visibleItemCount: number,
  restrictedView: boolean,
): string {
  if (restrictedView && visibleItemCount === 0) {
    return "Unplanned";
  }
  if (visibleItemCount === 0 && !day.title?.trim()) {
    return "Free day";
  }
  return day.title || `Day ${day.dayNumber}`;
}

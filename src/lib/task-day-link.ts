import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { itineraryDays } from "@/lib/schema";
import { toDateString } from "@/lib/trip-time";

/** Calendar date from a due-at value (preserves YYYY-MM-DD from datetime-local input). */
export function tripDateFromDueAt(
  value: string | Date | null | undefined,
): string | null {
  if (value == null || value === "") return null;
  if (typeof value === "string") {
    const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
    if (match) return match[1];
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return toDateString(date);
}

export async function resolveDayIdForTripDate(
  tripDate: string | null,
): Promise<number | null> {
  if (!tripDate) return null;
  const [day] = await db
    .select({ id: itineraryDays.id })
    .from(itineraryDays)
    .where(eq(itineraryDays.date, tripDate))
    .limit(1);
  return day?.id ?? null;
}

export async function resolveDayIdForDueAt(
  dueAt: string | Date | null | undefined,
): Promise<number | null> {
  return resolveDayIdForTripDate(tripDateFromDueAt(dueAt));
}

import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { itineraryDays } from "@/lib/schema";
import { parseTripDate, toDateString } from "@/lib/trip-time";

export function eachDateInRange(startDate: string, endDate: string): string[] {
  const start = parseTripDate(startDate);
  const end = parseTripDate(endDate);
  if (start.getTime() > end.getTime()) return [];

  const dates: string[] = [];
  const cursor = new Date(start);
  while (cursor.getTime() <= end.getTime()) {
    dates.push(toDateString(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

/** Assign day numbers 1…n in calendar date order. Does not change hidden flags or dates. */
export async function renumberItineraryDays(): Promise<{ updated: number; total: number }> {
  const existing = await db
    .select()
    .from(itineraryDays)
    .orderBy(asc(itineraryDays.date));

  if (existing.length === 0) {
    return { updated: 0, total: 0 };
  }

  let updated = 0;

  await db.transaction(async (tx) => {
    for (const day of existing) {
      await tx
        .update(itineraryDays)
        .set({ dayNumber: day.id + 1_000_000 })
        .where(eq(itineraryDays.id, day.id));
    }

    for (let index = 0; index < existing.length; index += 1) {
      const day = existing[index];
      const dayNumber = index + 1;
      if (day.dayNumber !== dayNumber) {
        updated += 1;
      }
      await tx
        .update(itineraryDays)
        .set({ dayNumber })
        .where(eq(itineraryDays.id, day.id));
    }
  });

  return { updated, total: existing.length };
}

/** Create any missing itinerary days between startDate and endDate (inclusive). */
export async function syncItineraryDaysForRange(
  startDate: string,
  endDate: string,
): Promise<{ created: number }> {
  const dates = eachDateInRange(startDate, endDate);
  if (dates.length === 0) {
    throw new Error("End date must be on or after start date.");
  }

  const existing = await db.select().from(itineraryDays);
  const byDate = new Map(existing.map((day) => [day.date, day]));
  let created = 0;

  for (const date of dates) {
    if (byDate.has(date)) continue;
    const [inserted] = await db
      .insert(itineraryDays)
      .values({
        dayNumber: 900_000 + existing.length + created,
        date,
        title: null,
        notes: null,
        hidden: false,
      })
      .returning();
    byDate.set(date, inserted);
    created += 1;
  }

  return { created };
}

/** Clear hidden on every itinerary day (recovery after a bad generate/sync). */
export async function unhideAllItineraryDays(): Promise<{ updated: number }> {
  const updated = await db
    .update(itineraryDays)
    .set({ hidden: false })
    .where(eq(itineraryDays.hidden, true))
    .returning({ id: itineraryDays.id });

  return { updated: updated.length };
}

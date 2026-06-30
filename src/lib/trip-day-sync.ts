import { asc, eq, inArray } from "drizzle-orm";
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

export async function syncItineraryDaysForRange(
  startDate: string,
  endDate: string,
): Promise<{ created: number; updated: number }> {
  const dates = eachDateInRange(startDate, endDate);
  if (dates.length === 0) {
    throw new Error("End date must be on or after start date.");
  }

  const existing = await db
    .select()
    .from(itineraryDays)
    .orderBy(asc(itineraryDays.date));

  const byDate = new Map(existing.map((day) => [day.date, day]));
  let created = 0;

  for (const date of dates) {
    if (byDate.has(date)) continue;
    const [inserted] = await db
      .insert(itineraryDays)
      .values({
        dayNumber: 100_000 + dates.indexOf(date),
        date,
        title: null,
        notes: null,
        hidden: false,
      })
      .returning();
    byDate.set(date, inserted);
    created += 1;
  }

  const inRange = [...byDate.values()]
    .filter((day) => day.date >= startDate && day.date <= endDate)
    .sort((a, b) => a.date.localeCompare(b.date));

  let updated = 0;
  await db.transaction(async (tx) => {
    for (const day of existing) {
      await tx
        .update(itineraryDays)
        .set({ dayNumber: day.id + 1_000_000 })
        .where(eq(itineraryDays.id, day.id));
    }

    for (let index = 0; index < inRange.length; index += 1) {
      const day = inRange[index];
      const dayNumber = index + 1;
      if (day.dayNumber !== dayNumber) updated += 1;
      await tx
        .update(itineraryDays)
        .set({ dayNumber })
        .where(eq(itineraryDays.id, day.id));
    }

    const staleIds = existing
      .filter((day) => day.date < startDate || day.date > endDate)
      .map((day) => day.id);
    if (staleIds.length > 0) {
      await tx
        .update(itineraryDays)
        .set({ hidden: true })
        .where(inArray(itineraryDays.id, staleIds));
    }
  });

  return { created, updated };
}

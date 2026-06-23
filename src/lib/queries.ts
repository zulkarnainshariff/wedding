import { asc, eq } from "drizzle-orm";
import { db } from "./db";
import { itineraryDays, itineraryItems } from "./schema";
import type { Category } from "./types";

export async function getDays() {
  return db
    .select()
    .from(itineraryDays)
    .orderBy(asc(itineraryDays.dayNumber));
}

export async function getTimeline() {
  const days = await getDays();
  const items = await db
    .select()
    .from(itineraryItems)
    .orderBy(asc(itineraryItems.startDatetime), asc(itineraryItems.sortOrder));

  return days.map((day) => ({
    ...day,
    items: items.filter((item) => item.dayId === day.id),
  }));
}

export async function getItemsByCategory(category: Category) {
  return db
    .select()
    .from(itineraryItems)
    .where(eq(itineraryItems.category, category))
    .orderBy(asc(itineraryItems.startDatetime), asc(itineraryItems.sortOrder));
}

export async function getAllItems() {
  return db
    .select()
    .from(itineraryItems)
    .orderBy(asc(itineraryItems.startDatetime), asc(itineraryItems.sortOrder));
}

export async function getItemById(id: number) {
  const [item] = await db
    .select()
    .from(itineraryItems)
    .where(eq(itineraryItems.id, id))
    .limit(1);
  return item ?? null;
}

export async function getDayById(id: number) {
  const [day] = await db
    .select()
    .from(itineraryDays)
    .where(eq(itineraryDays.id, id))
    .limit(1);
  return day ?? null;
}

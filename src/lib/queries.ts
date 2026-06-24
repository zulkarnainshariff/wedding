import { asc, eq, inArray } from "drizzle-orm";
import { getSessionUser } from "./auth";
import { db } from "./db";
import { filterItemsByPermission } from "./permissions";
import { itineraryDays, itineraryItems } from "./schema";
import { prepareDayItems, prepareScheduleDayItems } from "./timeline-utils";
import type { Category } from "./types";

const DAILY_SCHEDULE_CATEGORIES = ["activity", "flight", "pet_relocation"] as const;

async function getAuthorizedUser() {
  const user = await getSessionUser();
  if (!user) {
    throw new Error("Unauthorized");
  }
  return user;
}

export async function getDays() {
  return db
    .select()
    .from(itineraryDays)
    .orderBy(asc(itineraryDays.dayNumber));
}

export async function getTimeline() {
  const user = await getAuthorizedUser();
  const days = await getDays();
  const items = filterItemsByPermission(
    await db
      .select()
      .from(itineraryItems)
      .orderBy(asc(itineraryItems.startDatetime), asc(itineraryItems.sortOrder)),
    user,
  );

  return days.map((day) => ({
    ...day,
    items: prepareDayItems(items.filter((item) => item.dayId === day.id)),
  }));
}

export async function getScheduleByDate() {
  const user = await getAuthorizedUser();
  const days = await getDays();
  const scheduleItems = filterItemsByPermission(
    await db
      .select()
      .from(itineraryItems)
      .where(inArray(itineraryItems.category, [...DAILY_SCHEDULE_CATEGORIES]))
      .orderBy(asc(itineraryItems.sortOrder), asc(itineraryItems.startDatetime)),
    user,
  );

  return days.map((day) => ({
    ...day,
    items: prepareScheduleDayItems(
      scheduleItems.filter((item) => item.dayId === day.id),
    ),
  }));
}

export async function getItemsByCategory(category: Category) {
  const user = await getAuthorizedUser();
  const items = await db
    .select()
    .from(itineraryItems)
    .where(eq(itineraryItems.category, category))
    .orderBy(asc(itineraryItems.startDatetime), asc(itineraryItems.sortOrder));

  return filterItemsByPermission(items, user);
}

export async function getAllItems() {
  const user = await getAuthorizedUser();
  const items = await db
    .select()
    .from(itineraryItems)
    .orderBy(asc(itineraryItems.startDatetime), asc(itineraryItems.sortOrder));

  return filterItemsByPermission(items, user);
}

export async function getItemById(id: number) {
  const user = await getAuthorizedUser();
  const [item] = await db
    .select()
    .from(itineraryItems)
    .where(eq(itineraryItems.id, id))
    .limit(1);

  if (!item) return null;

  const filtered = filterItemsByPermission([item], user);
  return filtered[0] ?? null;
}

export async function getDayById(id: number) {
  const [day] = await db
    .select()
    .from(itineraryDays)
    .where(eq(itineraryDays.id, id))
    .limit(1);
  return day ?? null;
}

export async function getAllItemsUnfiltered() {
  return db
    .select()
    .from(itineraryItems)
    .orderBy(asc(itineraryItems.startDatetime), asc(itineraryItems.sortOrder));
}

export async function getAllDaysUnfiltered() {
  return getDays();
}

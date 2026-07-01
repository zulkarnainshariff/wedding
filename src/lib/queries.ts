import { asc, eq, inArray, isNull, and } from "drizzle-orm";
import { getSessionUser } from "./auth";
import { db } from "./db";
import { enrichItemsWithSubItems } from "./item-subitem-utils";
import { buildDaysWithItems, type DayWithItems } from "./item-scheduling";
import {
  filterItemsByPermission,
  filterParentsWithSubitemAccess,
  hasFullItemView,
} from "./permissions";
import type { SessionUser } from "./permissions";
import { itineraryDays, itineraryItems } from "./schema";
import { prepareDayItems, prepareScheduleDayItems } from "./timeline-utils";
import type { Category } from "./types";
import type { ItineraryItem } from "./schema";

const DAILY_SCHEDULE_CATEGORIES = ["activity", "flight", "pet_relocation"] as const;

async function getAuthorizedUser() {
  const user = await getSessionUser();
  if (!user) {
    throw new Error("Unauthorized");
  }
  return user;
}

async function fetchSubItemsForParents(
  parentIds: number[],
  user: SessionUser,
): Promise<ItineraryItem[]> {
  if (parentIds.length === 0) return [];

  return filterItemsByPermission(
    await db
      .select()
      .from(itineraryItems)
      .where(inArray(itineraryItems.parentItemId, parentIds))
      .orderBy(
        asc(itineraryItems.sortOrder),
        asc(itineraryItems.startDatetime),
      ),
    user,
  );
}

async function attachSubItemsToDays(
  days: DayWithItems[],
  user: SessionUser,
): Promise<DayWithItems[]> {
  const parentIds = days.flatMap((day) => day.items.map((item) => item.id));
  const children = await fetchSubItemsForParents(parentIds, user);

  return days.map((day) => ({
    ...day,
    items: enrichItemsWithSubItems(day.items, children).map((item) => ({
      ...item,
      limitedView:
        !hasFullItemView(item, user) &&
        (item.subItems?.length ?? 0) > 0,
    })),
  }));
}

async function attachSubItemsToItems(
  items: ItineraryItem[],
  user: SessionUser,
): Promise<ItineraryItem[]> {
  const parentIds = items.map((item) => item.id);
  const children = await fetchSubItemsForParents(parentIds, user);
  const visibleParents = filterParentsWithSubitemAccess(items, children, user);

  return enrichItemsWithSubItems(visibleParents, children).map((item) => ({
    ...item,
    limitedView:
      !hasFullItemView(item, user) && (item.subItems?.length ?? 0) > 0,
  }));
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
  const allParents = await db
    .select()
    .from(itineraryItems)
    .where(isNull(itineraryItems.parentItemId))
    .orderBy(asc(itineraryItems.startDatetime), asc(itineraryItems.sortOrder));
  const children = await fetchSubItemsForParents(
    allParents.map((item) => item.id),
    user,
  );
  const items = filterParentsWithSubitemAccess(allParents, children, user);

  const timeline = buildDaysWithItems(days, items, prepareDayItems);
  return attachSubItemsToDays(timeline, user);
}

export async function getScheduleByDate() {
  const user = await getAuthorizedUser();
  const days = await getDays();
  const scheduleParents = await db
    .select()
    .from(itineraryItems)
    .where(
      and(
        inArray(itineraryItems.category, [...DAILY_SCHEDULE_CATEGORIES]),
        isNull(itineraryItems.parentItemId),
      ),
    )
    .orderBy(asc(itineraryItems.startDatetime), asc(itineraryItems.sortOrder));
  const children = await fetchSubItemsForParents(
    scheduleParents.map((item) => item.id),
    user,
  );
  const scheduleItems = filterParentsWithSubitemAccess(
    scheduleParents,
    children,
    user,
  );

  const schedule = buildDaysWithItems(days, scheduleItems, prepareScheduleDayItems);
  return attachSubItemsToDays(schedule, user);
}

export async function getItemsByCategory(category: Category) {
  const user = await getAuthorizedUser();
  const categoryParents = await db
    .select()
    .from(itineraryItems)
    .where(
      and(
        eq(itineraryItems.category, category),
        isNull(itineraryItems.parentItemId),
      ),
    )
    .orderBy(asc(itineraryItems.startDatetime), asc(itineraryItems.sortOrder));
  const children = await fetchSubItemsForParents(
    categoryParents.map((item) => item.id),
    user,
  );
  const items = filterParentsWithSubitemAccess(categoryParents, children, user);

  return attachSubItemsToItems(items, user);
}

export async function getAllItems() {
  const user = await getAuthorizedUser();
  const allParents = await db
    .select()
    .from(itineraryItems)
    .where(isNull(itineraryItems.parentItemId))
    .orderBy(asc(itineraryItems.startDatetime), asc(itineraryItems.sortOrder));
  const children = await fetchSubItemsForParents(
    allParents.map((item) => item.id),
    user,
  );
  const items = filterParentsWithSubitemAccess(allParents, children, user);

  return attachSubItemsToItems(items, user);
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
  if (filtered.length > 0) {
    return filtered[0];
  }

  if (item.parentItemId == null) {
    const subitems = await fetchSubItemsForParents([item.id], user);
    if (subitems.length > 0) {
      return { ...item, limitedView: true as const };
    }
  }

  return null;
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

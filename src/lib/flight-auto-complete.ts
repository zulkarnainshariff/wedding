import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { isFlightLanded } from "@/lib/flight-progress";
import {
  getItemCompletion,
  withItemCompletion,
} from "@/lib/item-completion";
import type { FlightScheduleItem } from "@/lib/flight-progress";
import type { ItineraryItem } from "@/lib/schema";
import { itineraryItems } from "@/lib/schema";
import { bumpSyncVersion } from "@/lib/sync";

export async function autoCompleteLandedFlightItem(
  item: Pick<ItineraryItem, "id"> & FlightScheduleItem,
  now = new Date(),
): Promise<ItineraryItem | null> {
  if (item.category !== "flight") return null;
  if (getItemCompletion(item.details)) return null;
  if (!isFlightLanded(item, now)) return null;

  const nextDetails = withItemCompletion(
    (item.details ?? {}) as Record<string, unknown>,
    {
      completedAt: now.toISOString(),
      completedBy: null,
    },
  );

  const [updated] = await db
    .update(itineraryItems)
    .set({ details: nextDetails })
    .where(eq(itineraryItems.id, item.id))
    .returning();

  if (!updated) return null;

  await bumpSyncVersion();
  return updated;
}

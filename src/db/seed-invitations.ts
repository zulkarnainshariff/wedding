import "dotenv/config";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { publicScheduleItems, weddingEvents } from "@/lib/schema";

const PHILADELPHIA = {
  slug: "philadelphia",
  name: "Philadelphia Wedding",
  eventDate: "2026-07-16",
  location: "Philadelphia, Pennsylvania",
  sortOrder: 0,
  cardFront: {
    headline: "You're invited",
    coupleNames: "Natalie & Zulkarnain",
    dateLine: "Thursday, 16 July 2026",
    venue: "Morris Arboretum & Gardens",
    location: "Philadelphia, Pennsylvania",
    tagline: "We would be honoured by your presence",
    mapsUrl:
      "https://www.google.com/maps/place/morris+arboretum/data=!4m2!3m1!1s0x89c6bbdf9a144213:0x49e24bd00df62d42?sa=X&ved=1t:155783&ictx=111",
  },
  schedule: [
    { timeLabel: "5:30 PM", title: "Arrival of guests", sortOrder: 0 },
    { timeLabel: "6:00 PM", title: "Wedding ceremony", sortOrder: 1 },
    { timeLabel: "6:30 PM", title: "Cocktail hour", sortOrder: 2 },
    {
      timeLabel: "7:30 – 10:00 PM",
      title: "Reception and dinner",
      sortOrder: 3,
    },
  ],
};

const MELBOURNE = {
  slug: "melbourne",
  name: "Melbourne Celebration",
  eventDate: "2026-09-19",
  location: "Melbourne, Victoria",
  sortOrder: 1,
  cardFront: {
    headline: "Save the date",
    coupleNames: "Natalie & Zulkarnain",
    dateLine: "Saturday, 19 September 2026",
    venue: "Melbourne",
    location: "Victoria, Australia",
    tagline: "Join us for a second celebration",
  },
  schedule: [
    { timeLabel: "12:00 PM", title: "Arrival of guests", sortOrder: 0 },
    { timeLabel: "12:30 PM", title: "Arrival of bride and groom", sortOrder: 1 },
    { timeLabel: "1:00 PM", title: "Lunch", sortOrder: 2 },
  ],
};

async function upsertEvent(event: {
  slug: string;
  name: string;
  eventDate: string;
  location: string;
  sortOrder: number;
  cardFront: Record<string, unknown>;
  schedule: { timeLabel: string; title: string; sortOrder: number }[];
}): Promise<number> {
  const [existing] = await db
    .select()
    .from(weddingEvents)
    .where(eq(weddingEvents.slug, event.slug))
    .limit(1);

  let eventId: number;

  if (existing) {
    await db
      .update(weddingEvents)
      .set({
        name: event.name,
        eventDate: event.eventDate,
        location: event.location,
        cardFront: event.cardFront,
        sortOrder: event.sortOrder,
        published: true,
      })
      .where(eq(weddingEvents.id, existing.id));
    eventId = existing.id;

    await db
      .delete(publicScheduleItems)
      .where(eq(publicScheduleItems.eventId, eventId));
  } else {
    const [created] = await db
      .insert(weddingEvents)
      .values({
        slug: event.slug,
        name: event.name,
        eventDate: event.eventDate,
        location: event.location,
        cardFront: event.cardFront,
        sortOrder: event.sortOrder,
        published: true,
      })
      .returning({ id: weddingEvents.id });
    eventId = created.id;
  }

  if (event.schedule.length > 0) {
    await db.insert(publicScheduleItems).values(
      event.schedule.map((item) => ({
        eventId,
        timeLabel: item.timeLabel,
        title: item.title,
        sortOrder: item.sortOrder,
        published: true,
      })),
    );
  }

  return eventId;
}

async function main() {
  const phillyId = await upsertEvent(PHILADELPHIA);
  const melbourneId = await upsertEvent(MELBOURNE);
  console.log(`Seeded invitation events: Philadelphia (#${phillyId}), Melbourne (#${melbourneId})`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

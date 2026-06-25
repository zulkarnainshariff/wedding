import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import accommodationData from "./accommodation-data.json";
import carRentalData from "./car-rental-data.json";
import dailyItineraryData from "./daily-itinerary-data.json";
import flightData from "./flight-data.json";
import {
  ACTIVITY_LINKS,
  buildActivityDetails,
  buildActivitySummary,
  combineActivityDatetime,
  type RawDailyDay,
} from "../lib/activity-utils";
import {
  accommodationCheckInDatetime,
  accommodationCheckOutDatetime,
  buildAccommodationDetails,
  buildAccommodationSummary,
  type RawAccommodation,
} from "../lib/accommodation-utils";
import {
  buildCarRentalDetails,
  buildCarRentalSummary,
  carRentalPickupDatetime,
  type RawCarRental,
} from "../lib/car-rental-utils";
import {
  buildFlightCategory,
  buildFlightDetails,
  buildFlightSummary,
  buildPetRelocationDetails,
  combineDateTime,
  type RawFlight,
} from "../lib/flight-utils";
import { parseStoredClockTime, resolveFlightSchedule } from "../lib/flight-datetime";
import { normalizeGuestText } from "../lib/travellers";
import { hashPassword } from "../lib/auth";
import {
  ADMIN_PERMISSIONS,
  DEFAULT_PERMISSIONS,
} from "../lib/permissions";
import { itineraryDays, itineraryItems, users } from "../lib/schema";
import { bumpSyncVersion } from "../lib/sync";
import { SEED_USERS } from "./users-data";
import type { ItineraryItem } from "../lib/schema";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

const client = postgres(connectionString, { prepare: false });
const db = drizzle(client);

type InsertedItem = ItineraryItem;

function findItemId(
  items: InsertedItem[],
  category: string,
  title: string,
): number | undefined {
  return items.find((i) => i.category === category && i.title === title)?.id;
}

function syncTimeFromLinkedItem(
  link: (typeof ACTIVITY_LINKS)[string] | undefined,
  linked: InsertedItem | undefined,
  activityTime: string | null | undefined,
  date: string,
): Date | null {
  if (activityTime) return combineActivityDatetime(date, activityTime);
  if (!linked || !link) return null;

  if (link.syncArrivalTime && linked.endDatetime) {
    return new Date(linked.endDatetime);
  }
  if (link.syncDepartureTime && linked.startDatetime) {
    return new Date(linked.startDatetime);
  }

  const flightDetails = linked.details as { arrivalTime?: string; departureTime?: string };
  if (link.syncArrivalTime && flightDetails.arrivalTime) {
    const parsed = parseStoredClockTime(flightDetails.arrivalTime);
    return combineDateTime(
      parsed?.embeddedDate ?? date,
      flightDetails.arrivalTime,
    );
  }
  if (link.syncDepartureTime && flightDetails.departureTime) {
    return combineDateTime(date, flightDetails.departureTime);
  }

  return linked.startDatetime ? new Date(linked.startDatetime) : null;
}

async function seed() {
  console.log("Seeding database...");

  await db.delete(itineraryItems);
  await db.delete(itineraryDays);
  await db.delete(users);

  const userRows = await Promise.all(
    SEED_USERS.map(async (entry) => ({
      username: entry.username,
      passwordHash: await hashPassword(entry.password),
      isAdmin: entry.isAdmin ?? false,
      permissions: entry.isAdmin ? ADMIN_PERMISSIONS : DEFAULT_PERMISSIONS,
    })),
  );
  await db.insert(users).values(userRows);

  const flights = flightData.flights as unknown as RawFlight[];
  const accommodations =
    accommodationData.accommodations as unknown as RawAccommodation[];
  const carRentals = carRentalData.carRentals as unknown as RawCarRental[];
  const dailyDays =
    dailyItineraryData.dailyItinerary as unknown as RawDailyDay[];

  const dailyByDate = Object.fromEntries(dailyDays.map((d) => [d.date, d]));

  const uniqueDates = [
    ...new Set([
      ...flights.map((f) => f.date),
      ...accommodations.map((a) => a.checkInDate),
      ...accommodations.map((a) => a.checkOutDate).filter(Boolean) as string[],
      ...carRentals.map((c) => c.pickupDate),
      ...dailyDays.map((d) => d.date),
    ]),
  ].sort();

  const insertedDays = await db
    .insert(itineraryDays)
    .values(
      uniqueDates.map((date, index) => {
        const scheduleDay = dailyByDate[date];
        return {
          dayNumber: index + 1,
          date,
          title: scheduleDay?.title ?? scheduleDay?.day ?? undefined,
          notes: null,
        };
      }),
    )
    .returning();

  const dayIdByDate = Object.fromEntries(
    insertedDays.map((day) => [day.date, day.id]),
  );

  const flightRows = flights.map((flight, index) => {
    const category = buildFlightCategory(flight);
    const details =
      category === "pet_relocation"
        ? buildPetRelocationDetails(flight)
        : buildFlightDetails(flight);

    const schedule =
      category === "flight"
        ? resolveFlightSchedule({ eventDate: flight.date, details })
        : null;

    return {
      dayId: dayIdByDate[flight.date],
      category,
      title: flight.label,
      summary: buildFlightSummary(flight, category),
      eventDate: schedule?.eventDate ?? flight.date,
      startDatetime:
        schedule?.startDatetime ??
        combineDateTime(flight.date, flight.departureTime),
      endDatetime:
        schedule?.endDatetime ??
        combineDateTime(flight.date, flight.arrivalTime),
      sortOrder: 200 + index,
      details,
    };
  });

  const accommodationRows = accommodations.map((stay, index) => {
    const details = buildAccommodationDetails(stay);
    return {
      dayId: dayIdByDate[stay.checkInDate],
      category: "accommodation" as const,
      title: stay.label,
      summary: buildAccommodationSummary(stay),
      eventDate: stay.checkInDate,
      startDatetime: accommodationCheckInDatetime(stay.checkInDate),
      endDatetime: accommodationCheckOutDatetime(stay.checkOutDate),
      sortOrder: 300 + index,
      details,
    };
  });

  const carRentalRows = carRentals.map((rental, index) => {
    const details = buildCarRentalDetails(rental);
    return {
      dayId: dayIdByDate[rental.pickupDate],
      category: "car_rental" as const,
      title: rental.label,
      summary: buildCarRentalSummary(rental),
      eventDate: rental.pickupDate,
      startDatetime: carRentalPickupDatetime(rental.pickupDate, rental.pickupTime),
      endDatetime: rental.returnDate
        ? carRentalPickupDatetime(rental.returnDate, rental.returnTime)
        : null,
      sortOrder: 400 + index,
      details,
    };
  });

  const bookingItems = await db
    .insert(itineraryItems)
    .values([...flightRows, ...accommodationRows, ...carRentalRows])
    .returning();

  const activityRows = dailyDays.flatMap((day) =>
    day.items.map((raw, index) => {
      const link = ACTIVITY_LINKS[raw.id];
      const linkedItemId = link
        ? findItemId(bookingItems, link.category, link.title)
        : undefined;
      const linkedItem = linkedItemId
        ? bookingItems.find((item) => item.id === linkedItemId)
        : undefined;

      const details = buildActivityDetails(raw, linkedItemId);
      const startDatetime = syncTimeFromLinkedItem(
        link,
        linkedItem,
        raw.time,
        day.date,
      );

      return {
        dayId: dayIdByDate[day.date],
        category: "activity" as const,
        title: normalizeGuestText(raw.title),
        summary: buildActivitySummary(raw),
        eventDate: day.date,
        startDatetime,
        endDatetime: null,
        sortOrder: index,
        details: {
          ...details,
          time:
            startDatetime && link?.syncArrivalTime
              ? startDatetime.toLocaleTimeString("en-GB", {
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: false,
                })
              : (raw.time ?? details.time),
        },
      };
    }),
  );

  await db.insert(itineraryItems).values(activityRows);

  await bumpSyncVersion();

  console.log(
    `Seed complete: ${uniqueDates.length} days, ${activityRows.length} schedule items, ${bookingItems.length} bookings, ${SEED_USERS.length} users.`,
  );
  await client.end();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});

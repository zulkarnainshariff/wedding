import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { itineraryDays, itineraryItems } from "../lib/schema";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

const client = postgres(connectionString, { prepare: false });
const db = drizzle(client);

async function seed() {
  console.log("Seeding database...");

  await db.delete(itineraryItems);
  await db.delete(itineraryDays);

  const days = await db
    .insert(itineraryDays)
    .values([
      {
        dayNumber: 1,
        date: "2026-06-26",
        title: "Departure Day",
        notes: "Fly from Kuala Lumpur to Bali",
      },
      {
        dayNumber: 2,
        date: "2026-06-27",
        title: "Ubud Arrival",
        notes: "Settle into villa and pick up rental car",
      },
      {
        dayNumber: 3,
        date: "2026-06-28",
        title: "Wedding Eve",
        notes: "Rehearsal dinner and family time",
      },
      {
        dayNumber: 4,
        date: "2026-06-29",
        title: "Wedding Day",
        notes: "The big day!",
      },
      {
        dayNumber: 5,
        date: "2026-06-30",
        title: "Departure",
        notes: "Return flights and car drop-off",
      },
    ])
    .returning();

  const dayByNumber = Object.fromEntries(days.map((d) => [d.dayNumber, d.id]));

  await db.insert(itineraryItems).values([
    {
      dayId: dayByNumber[1],
      category: "flight",
      title: "MH850 — Kuala Lumpur to Denpasar",
      summary: "Malaysia Airlines · KLIA to Ngurah Rai",
      startDatetime: new Date("2026-06-26T08:30:00+08:00"),
      endDatetime: new Date("2026-06-26T11:45:00+08:00"),
      sortOrder: 1,
      details: {
        airline: "Malaysia Airlines",
        flightNumber: "MH850",
        departureAirport: "Kuala Lumpur International (KUL)",
        arrivalAirport: "Ngurah Rai International (DPS)",
        departureTime: "08:30",
        arrivalTime: "11:45",
        confirmationCode: "ABC123",
        terminal: "KLIA Terminal 1",
        seat: "12A, 12B",
      },
    },
    {
      dayId: dayByNumber[1],
      category: "accommodation",
      title: "Villa Seminyak — First Night",
      summary: "Airbnb · 2 nights near Seminyak Beach",
      startDatetime: new Date("2026-06-26T15:00:00+08:00"),
      endDatetime: new Date("2026-06-28T11:00:00+08:00"),
      sortOrder: 2,
      details: {
        platform: "Airbnb",
        listingUrl: "https://www.airbnb.com/rooms/example-seminyak",
        address: "Jl. Petitenget No.12, Seminyak, Bali",
        lat: -8.6845,
        lng: 115.1625,
        checkInTime: "15:00",
        checkOutTime: "11:00",
        hostName: "Made",
        confirmationCode: "HMXYZ789",
        notes: "Gate code: 4521. Villa manager will meet you on arrival.",
      },
    },
    {
      dayId: dayByNumber[2],
      category: "car_rental",
      title: "Toyota Avanza — Bali Rental",
      summary: "Avis · 4-day rental with airport pickup",
      startDatetime: new Date("2026-06-27T09:00:00+08:00"),
      endDatetime: new Date("2026-06-30T17:00:00+08:00"),
      sortOrder: 1,
      details: {
        company: "Avis Bali",
        vehicleModel: "Toyota Avanza (Automatic)",
        pickupLocation: "Ngurah Rai Airport, Domestic Terminal Car Rental Counter",
        pickupLat: -8.7482,
        pickupLng: 115.1675,
        pickupTime: "09:00",
        returnLocation: "Ngurah Rai Airport, Domestic Terminal Car Rental Counter",
        returnLat: -8.7482,
        returnLng: 115.1675,
        returnTime: "17:00",
        confirmationCode: "AVIS-2026-4455",
        notes: "International driving permit required. Full insurance included.",
      },
    },
    {
      dayId: dayByNumber[3],
      category: "flight",
      title: "Internal — Denpasar to Lombok (family)",
      summary: "Garuda Indonesia · Day trip for some guests",
      startDatetime: new Date("2026-06-28T07:00:00+08:00"),
      endDatetime: new Date("2026-06-28T08:15:00+08:00"),
      sortOrder: 1,
      details: {
        airline: "Garuda Indonesia",
        flightNumber: "GA452",
        departureAirport: "Ngurah Rai International (DPS)",
        arrivalAirport: "Lombok International (LOP)",
        departureTime: "07:00",
        arrivalTime: "08:15",
        confirmationCode: "GID98765",
        terminal: "Domestic Terminal",
      },
    },
    {
      dayId: dayByNumber[3],
      category: "accommodation",
      title: "Ubud Jungle Villa — Wedding Week",
      summary: "Airbnb · 3 nights in Ubud",
      startDatetime: new Date("2026-06-28T14:00:00+08:00"),
      endDatetime: new Date("2026-07-01T10:00:00+08:00"),
      sortOrder: 2,
      details: {
        platform: "Airbnb",
        listingUrl: "https://www.airbnb.com/rooms/example-ubud",
        address: "Jalan Raya Sanggingan, Ubud, Gianyar, Bali",
        lat: -8.5069,
        lng: 115.2625,
        checkInTime: "14:00",
        checkOutTime: "10:00",
        hostName: "Ketut",
        confirmationCode: "HMUBUD456",
        notes: "Wedding party villa. Pool and kitchen available.",
      },
    },
    {
      dayId: dayByNumber[4],
      category: "car_rental",
      title: "Toyota Innova — Wedding Day Transport",
      summary: "Local hire with driver for wedding day",
      startDatetime: new Date("2026-06-29T08:00:00+08:00"),
      endDatetime: new Date("2026-06-29T23:00:00+08:00"),
      sortOrder: 1,
      details: {
        company: "Bali Wedding Cars",
        vehicleModel: "Toyota Innova Reborn with driver",
        pickupLocation: "Ubud Jungle Villa, Jalan Raya Sanggingan",
        pickupLat: -8.5069,
        pickupLng: 115.2625,
        pickupTime: "08:00",
        returnLocation: "Ubud Jungle Villa, Jalan Raya Sanggingan",
        returnLat: -8.5069,
        returnLng: 115.2625,
        returnTime: "23:00",
        confirmationCode: "BWC-WED-001",
        notes: "Includes decoration ribbon. Driver: Pak Wayan (+62 812-3456-7890).",
      },
    },
    {
      dayId: dayByNumber[5],
      category: "flight",
      title: "MH851 — Denpasar to Kuala Lumpur",
      summary: "Malaysia Airlines · Return flight",
      startDatetime: new Date("2026-06-30T19:30:00+08:00"),
      endDatetime: new Date("2026-06-30T22:45:00+08:00"),
      sortOrder: 1,
      details: {
        airline: "Malaysia Airlines",
        flightNumber: "MH851",
        departureAirport: "Ngurah Rai International (DPS)",
        arrivalAirport: "Kuala Lumpur International (KUL)",
        departureTime: "19:30",
        arrivalTime: "22:45",
        confirmationCode: "ABC124",
        terminal: "International Terminal",
        seat: "14C, 14D",
      },
    },
  ]);

  console.log("Seed complete: 5 days, 7 items (3 flights, 2 accommodation, 2 car rental).");
  await client.end();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});

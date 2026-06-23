import {
  date,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const itineraryDays = pgTable("itinerary_days", {
  id: serial("id").primaryKey(),
  dayNumber: integer("day_number").notNull().unique(),
  date: date("date").notNull(),
  title: text("title"),
  notes: text("notes"),
});

export const itineraryItems = pgTable("itinerary_items", {
  id: serial("id").primaryKey(),
  dayId: integer("day_id").references(() => itineraryDays.id, {
    onDelete: "set null",
  }),
  category: text("category").notNull(),
  title: text("title").notNull(),
  summary: text("summary"),
  startDatetime: timestamp("start_datetime", { withTimezone: true }),
  endDatetime: timestamp("end_datetime", { withTimezone: true }),
  sortOrder: integer("sort_order").default(0).notNull(),
  details: jsonb("details").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type ItineraryDay = typeof itineraryDays.$inferSelect;
export type NewItineraryDay = typeof itineraryDays.$inferInsert;
export type ItineraryItem = typeof itineraryItems.$inferSelect;
export type NewItineraryItem = typeof itineraryItems.$inferInsert;

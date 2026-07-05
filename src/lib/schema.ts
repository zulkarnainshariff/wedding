import {
  boolean,
  date,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const itineraryDays = pgTable("itinerary_days", {
  id: serial("id").primaryKey(),
  dayNumber: integer("day_number").notNull().unique(),
  date: date("date").notNull().unique(),
  title: text("title"),
  notes: text("notes"),
  hidden: boolean("hidden").default(false).notNull(),
});

export const itineraryItems = pgTable("itinerary_items", {
  id: serial("id").primaryKey(),
  dayId: integer("day_id").references(() => itineraryDays.id, {
    onDelete: "set null",
  }),
  parentItemId: integer("parent_item_id"),
  category: text("category").notNull(),
  title: text("title").notNull(),
  summary: text("summary"),
  eventDate: date("event_date"),
  startDatetime: timestamp("start_datetime", { withTimezone: true }),
  endDatetime: timestamp("end_datetime", { withTimezone: true }),
  sortOrder: integer("sort_order").default(0).notNull(),
  details: jsonb("details").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const itemDocuments = pgTable("item_documents", {
  id: serial("id").primaryKey(),
  itemId: integer("item_id")
    .notNull()
    .references(() => itineraryItems.id, { onDelete: "cascade" }),
  travellerName: text("traveller_name").notNull(),
  coversTravellers: jsonb("covers_travellers").notNull().default([]),
  label: text("label").notNull(),
  fileName: text("file_name").notNull(),
  storageKey: text("storage_key").notNull().unique(),
  mimeType: text("mime_type"),
  fileSize: integer("file_size"),
  uploadedByUserId: integer("uploaded_by_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  extraViewers: jsonb("extra_viewers").notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  isAdmin: boolean("is_admin").default(false).notNull(),
  roleLevel: integer("role_level").default(3).notNull(),
  permissions: jsonb("permissions").notNull().default({}),
  preferences: jsonb("preferences").notNull().default({}),
  tokenVersion: integer("token_version").default(0).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/** Users listed here can view all itinerary entries for the ward account. */
export const userGuardians = pgTable(
  "user_guardians",
  {
    wardUserId: integer("ward_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    guardianUserId: integer("guardian_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.wardUserId, table.guardianUserId] })],
);

export const syncMetadata = pgTable("sync_metadata", {
  id: integer("id").primaryKey().default(1),
  updateId: text("update_id").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type AppFeatureFlags = {
  guestbookEnabled?: boolean;
  photoGalleryEnabled?: boolean;
  tripStartDate?: string | null;
  tripEndDate?: string | null;
};

export const appSettings = pgTable("app_settings", {
  id: integer("id").primaryKey().default(1),
  themeId: text("theme_id").notNull().default("azure-blossom"),
  features: jsonb("features").$type<AppFeatureFlags>().notNull().default({}),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const weddingEvents = pgTable("wedding_events", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  eventDate: date("event_date").notNull(),
  location: text("location"),
  cardFront: jsonb("card_front").notNull().default({}),
  sortOrder: integer("sort_order").default(0).notNull(),
  published: boolean("published").default(true).notNull(),
});

export const publicScheduleItems = pgTable("public_schedule_items", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id")
    .notNull()
    .references(() => weddingEvents.id, { onDelete: "cascade" }),
  timeLabel: text("time_label").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  sortOrder: integer("sort_order").default(0).notNull(),
  published: boolean("published").default(true).notNull(),
});

export const eventRsvpSettings = pgTable("event_rsvp_settings", {
  eventId: integer("event_id")
    .primaryKey()
    .references(() => weddingEvents.id, { onDelete: "cascade" }),
  rsvpEnabled: boolean("rsvp_enabled").default(true).notNull(),
  rsvpDeadline: timestamp("rsvp_deadline", { withTimezone: true }),
  contactName: text("contact_name"),
  contactPhone: text("contact_phone"),
  contactEmail: text("contact_email"),
});

export const guestListPermissions = pgTable("guest_list_permissions", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id")
    .notNull()
    .references(() => weddingEvents.id, { onDelete: "cascade" }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  canView: boolean("can_view").default(true).notNull(),
  canEdit: boolean("can_edit").default(false).notNull(),
  isWeddingCoordinator: boolean("is_wedding_coordinator").default(false).notNull(),
  canModerateGuestbook: boolean("can_moderate_guestbook").default(false).notNull(),
});

export const guests = pgTable("guests", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id")
    .notNull()
    .references(() => weddingEvents.id, { onDelete: "cascade" }),
  inviteToken: text("invite_token").notNull().unique(),
  label: text("label").notNull(),
  allowIncludeFamily: boolean("allow_include_family").default(false).notNull(),
  expectedHeadcount: integer("expected_headcount").default(1).notNull(),
  rsvpStatus: text("rsvp_status").default("not_responded").notNull(),
  rsvpAttendingCount: integer("rsvp_attending_count"),
  rsvpNotes: text("rsvp_notes"),
  adminNotes: text("admin_notes"),
  contactEmail: text("contact_email"),
  sortOrder: integer("sort_order").default(0).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const guestMembers = pgTable("guest_members", {
  id: serial("id").primaryKey(),
  guestId: integer("guest_id")
    .notNull()
    .references(() => guests.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  under13: boolean("under_13").default(false).notNull(),
  attending: boolean("attending").default(true).notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
});

export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  title: text("title").notNull(),
  body: text("body"),
  href: text("href"),
  metadata: jsonb("metadata").default({}),
  readAt: timestamp("read_at", { withTimezone: true }),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const taskPermissions = pgTable("task_permissions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  eventId: integer("event_id")
    .notNull()
    .references(() => weddingEvents.id, { onDelete: "cascade" }),
  canAssign: boolean("can_assign").default(false).notNull(),
  canAssignForOthers: boolean("can_assign_for_others").default(false).notNull(),
  canViewOthersTasks: boolean("can_view_others_tasks").default(false).notNull(),
  viewableUserIds: jsonb("viewable_user_ids")
    .$type<number[]>()
    .default([])
    .notNull(),
});

export const tasks = pgTable("tasks", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").references(() => weddingEvents.id, {
    onDelete: "cascade",
  }),
  dayId: integer("day_id").references(() => itineraryDays.id, {
    onDelete: "set null",
  }),
  itemId: integer("item_id").references(() => itineraryItems.id, {
    onDelete: "set null",
  }),
  parentTaskId: integer("parent_task_id"),
  title: text("title").notNull(),
  assignerNotes: text("assigner_notes"),
  status: text("status").default("not_started").notNull(),
  assigneeUserId: integer("assignee_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdByUserId: integer("created_by_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  dueAt: timestamp("due_at", { withTimezone: true }),
  allowSubtasks: boolean("allow_subtasks").default(false).notNull(),
  allowTaggedNotes: boolean("allow_tagged_notes").default(false).notNull(),
  allowAssigneeEdit: boolean("allow_assignee_edit").default(false).notNull(),
  statusReason: text("status_reason"),
  isUrgent: boolean("is_urgent").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const taskNotes = pgTable("task_notes", {
  id: serial("id").primaryKey(),
  taskId: integer("task_id")
    .notNull()
    .references(() => tasks.id, { onDelete: "cascade" }),
  authorUserId: integer("author_user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  taggedUserId: integer("tagged_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
});

export const taskReminders = pgTable("task_reminders", {
  id: serial("id").primaryKey(),
  taskId: integer("task_id")
    .notNull()
    .references(() => tasks.id, { onDelete: "cascade" }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  remindAt: timestamp("remind_at", { withTimezone: true }).notNull(),
  processed: boolean("processed").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const loginLogs = pgTable("login_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
  username: text("username"),
  eventType: text("event_type").notNull(),
  sessionId: text("session_id"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  metadata: jsonb("metadata").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
  username: text("username"),
  action: text("action").notNull(),
  resourceType: text("resource_type").notNull(),
  resourceId: text("resource_id"),
  summary: text("summary"),
  metadata: jsonb("metadata").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const usageLogs = pgTable("usage_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
  username: text("username"),
  sessionId: text("session_id").notNull(),
  eventType: text("event_type").notNull(),
  path: text("path"),
  metadata: jsonb("metadata").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const errorLogs = pgTable("error_logs", {
  id: serial("id").primaryKey(),
  operation: text("operation").notNull(),
  resourceType: text("resource_type").notNull(),
  resourceId: text("resource_id"),
  summary: text("summary").notNull(),
  errorMessage: text("error_message").notNull(),
  userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
  username: text("username"),
  metadata: jsonb("metadata").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const guestbookEntries = pgTable("guestbook_entries", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id")
    .notNull()
    .references(() => weddingEvents.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  message: text("message").notNull(),
  email: text("email"),
  hidden: boolean("hidden").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const galleryPhotos = pgTable("gallery_photos", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id")
    .notNull()
    .references(() => weddingEvents.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  caption: text("caption"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const galleryPhotoTags = pgTable(
  "gallery_photo_tags",
  {
    photoId: integer("photo_id")
      .notNull()
      .references(() => galleryPhotos.id, { onDelete: "cascade" }),
    email: text("email"),
    guestName: text("guest_name").notNull(),
  },
  (table) => [primaryKey({ columns: [table.photoId, table.guestName] })],
);

export const userActivitySessions = pgTable("user_activity_sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  sessionId: text("session_id").notNull().unique(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
});

export type ItineraryDay = typeof itineraryDays.$inferSelect;
export type NewItineraryDay = typeof itineraryDays.$inferInsert;
export type ItineraryItem = typeof itineraryItems.$inferSelect;
export type NewItineraryItem = typeof itineraryItems.$inferInsert;
export type ItemDocument = typeof itemDocuments.$inferSelect;
export type NewItemDocument = typeof itemDocuments.$inferInsert;
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type UserGuardian = typeof userGuardians.$inferSelect;
export type SyncMetadata = typeof syncMetadata.$inferSelect;
export type AppSettingsRow = typeof appSettings.$inferSelect;
export type WeddingEvent = typeof weddingEvents.$inferSelect;
export type NewWeddingEvent = typeof weddingEvents.$inferInsert;
export type PublicScheduleItemRow = typeof publicScheduleItems.$inferSelect;
export type NewPublicScheduleItem = typeof publicScheduleItems.$inferInsert;
export type EventRsvpSettings = typeof eventRsvpSettings.$inferSelect;
export type GuestListPermission = typeof guestListPermissions.$inferSelect;
export type Guest = typeof guests.$inferSelect;
export type NewGuest = typeof guests.$inferInsert;
export type GuestMember = typeof guestMembers.$inferSelect;
export type NewGuestMember = typeof guestMembers.$inferInsert;
export type NotificationRow = typeof notifications.$inferSelect;
export type TaskPermission = typeof taskPermissions.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type TaskNote = typeof taskNotes.$inferSelect;
export type TaskReminder = typeof taskReminders.$inferSelect;
export type LoginLog = typeof loginLogs.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
export type UsageLog = typeof usageLogs.$inferSelect;
export type UserActivitySession = typeof userActivitySessions.$inferSelect;
export type ErrorLog = typeof errorLogs.$inferSelect;
export type GuestbookEntry = typeof guestbookEntries.$inferSelect;
export type GalleryPhoto = typeof galleryPhotos.$inferSelect;
export type GalleryPhotoTag = typeof galleryPhotoTags.$inferSelect;

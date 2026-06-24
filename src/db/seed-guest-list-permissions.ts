import "dotenv/config";
import { and, asc, eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { guestListPermissions, users, weddingEvents } from "../lib/schema";

const HOST_USERNAMES = ["natalie", "zulkarnain"] as const;

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

const client = postgres(connectionString, { prepare: false });
const db = drizzle(client);

async function main() {
  const events = await db
    .select()
    .from(weddingEvents)
    .orderBy(asc(weddingEvents.sortOrder));

  if (!events.length) {
    console.error(
      "No wedding_events found. Run npm run db:seed-invitations first.",
    );
    process.exit(1);
  }

  const hosts = await db
    .select()
    .from(users)
    .where(inArray(users.username, [...HOST_USERNAMES]));

  if (!hosts.length) {
    console.error(
      "Could not find natalie/zulkarnain users. Run npm run db:seed-users.",
    );
    process.exit(1);
  }

  let upserted = 0;
  for (const host of hosts) {
    for (const event of events) {
      const [existing] = await db
        .select()
        .from(guestListPermissions)
        .where(
          and(
            eq(guestListPermissions.userId, host.id),
            eq(guestListPermissions.eventId, event.id),
          ),
        )
        .limit(1);

      if (existing) {
        if (!existing.canView || !existing.canEdit) {
          await db
            .update(guestListPermissions)
            .set({ canView: true, canEdit: true })
            .where(eq(guestListPermissions.id, existing.id));
          upserted += 1;
        }
        continue;
      }

      await db.insert(guestListPermissions).values({
        eventId: event.id,
        userId: host.id,
        canView: true,
        canEdit: true,
      });
      upserted += 1;
    }
  }

  console.log(
    `Guest list permissions: ensured ${hosts.length} hosts have view+edit on ${events.length} event(s) (${upserted} row(s) created/updated).`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => client.end());

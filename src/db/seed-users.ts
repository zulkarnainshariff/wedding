import "dotenv/config";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { hashPassword } from "../lib/auth";
import { ADMIN_PERMISSIONS, DEFAULT_PERMISSIONS } from "../lib/permissions";
import { users } from "../lib/schema";
import { SEED_USERS } from "./users-data";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

const client = postgres(connectionString, { prepare: false });
const db = drizzle(client);

async function seedUsers() {
  console.log("Seeding users...");

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const entry of SEED_USERS) {
    const [existing] = await db
      .select()
      .from(users)
      .where(eq(users.username, entry.username))
      .limit(1);

    if (existing) {
      if (!entry.updateIfExists) {
        skipped += 1;
        continue;
      }

      const passwordHash = await hashPassword(entry.password);
      await db
        .update(users)
        .set({
          passwordHash,
          tokenVersion: existing.tokenVersion + 1,
        })
        .where(eq(users.id, existing.id));

      updated += 1;
      console.log(`  updated ${entry.username}`);
      continue;
    }

    const passwordHash = await hashPassword(entry.password);
    await db.insert(users).values({
      username: entry.username,
      passwordHash,
      isAdmin: entry.isAdmin ?? false,
      permissions: entry.isAdmin ? ADMIN_PERMISSIONS : DEFAULT_PERMISSIONS,
    });

    created += 1;
    console.log(`  created ${entry.username}`);
  }

  console.log(
    `User seed complete: ${created} created, ${updated} updated, ${skipped} skipped.`,
  );
  await client.end();
}

seedUsers().catch((err) => {
  console.error(err);
  process.exit(1);
});

import "dotenv/config";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { hashPassword } from "../lib/auth";
import {
  ADMIN_PERMISSIONS,
  DEFAULT_PERMISSIONS,
  normalizePermissions,
  type UserPermissions,
} from "../lib/permissions";
import { ROLE_ADMIN, ROLE_USER } from "../lib/role-levels";
import { users } from "../lib/schema";
import { SEED_USERS } from "./users-data";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

const client = postgres(connectionString, { prepare: false });
const db = drizzle(client);

function seedPermissionsFor(entry: (typeof SEED_USERS)[number]): UserPermissions {
  if (entry.isAdmin || entry.roleLevel === 0) return ADMIN_PERMISSIONS;
  return normalizePermissions(
    { ...DEFAULT_PERMISSIONS, ...entry.permissions },
    false,
    entry.username,
  );
}

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

    const roleLevel =
      entry.roleLevel ??
      (entry.isAdmin ? ROLE_ADMIN : ROLE_USER);
    const isAdmin = roleLevel <= ROLE_ADMIN;

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
          roleLevel,
          isAdmin,
          ...(entry.permissions
            ? { permissions: seedPermissionsFor(entry) }
            : {}),
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
      isAdmin,
      roleLevel,
      permissions: seedPermissionsFor(entry),
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

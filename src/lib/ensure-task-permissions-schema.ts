import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

let ready = false;

/** Idempotent prod-safe guard for task_permissions.viewable_user_ids. */
export async function ensureTaskViewPermissionsSchema(): Promise<void> {
  if (ready) return;

  await db.execute(sql`
    ALTER TABLE task_permissions
    ADD COLUMN IF NOT EXISTS viewable_user_ids jsonb NOT NULL DEFAULT '[]'::jsonb
  `);

  ready = true;
}

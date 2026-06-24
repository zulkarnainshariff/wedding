import { randomUUID } from "crypto";
import { db } from "./db";
import { notifySyncUpdate } from "./sync-events";
import { syncMetadata } from "./schema";

export async function getCurrentUpdateId(): Promise<string> {
  const [row] = await db.select().from(syncMetadata).limit(1);
  if (row?.updateId) return row.updateId;

  const updateId = randomUUID();
  await db
    .insert(syncMetadata)
    .values({ id: 1, updateId })
    .onConflictDoUpdate({
      target: syncMetadata.id,
      set: { updateId, updatedAt: new Date() },
    });
  return updateId;
}

export async function bumpSyncVersion(): Promise<string> {
  const updateId = randomUUID();
  await db
    .insert(syncMetadata)
    .values({ id: 1, updateId, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: syncMetadata.id,
      set: { updateId, updatedAt: new Date() },
    });
  notifySyncUpdate(updateId);
  return updateId;
}

export async function ensureSyncMetadata(): Promise<void> {
  await getCurrentUpdateId();
}

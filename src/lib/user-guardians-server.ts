import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { userGuardians, users } from "@/lib/schema";

export async function getWardUsernamesForGuardian(
  guardianUserId: number,
): Promise<string[]> {
  const rows = await db
    .select({ username: users.username })
    .from(userGuardians)
    .innerJoin(users, eq(userGuardians.wardUserId, users.id))
    .where(eq(userGuardians.guardianUserId, guardianUserId));

  return rows.map((row) => row.username.toLowerCase());
}

export async function getGuardianUserIdsForWard(
  wardUserId: number,
): Promise<number[]> {
  const rows = await db
    .select({ guardianUserId: userGuardians.guardianUserId })
    .from(userGuardians)
    .where(eq(userGuardians.wardUserId, wardUserId));

  return rows.map((row) => row.guardianUserId);
}

export async function setGuardiansForWard(
  wardUserId: number,
  guardianUserIds: number[],
): Promise<void> {
  const uniqueGuardianIds = [
    ...new Set(
      guardianUserIds.filter(
        (guardianUserId) =>
          Number.isFinite(guardianUserId) && guardianUserId !== wardUserId,
      ),
    ),
  ];

  await db.delete(userGuardians).where(eq(userGuardians.wardUserId, wardUserId));

  if (uniqueGuardianIds.length === 0) return;

  await db.insert(userGuardians).values(
    uniqueGuardianIds.map((guardianUserId) => ({
      wardUserId,
      guardianUserId,
    })),
  );
}

export async function loadGuardianUserIdsByWard(
  wardUserIds: number[],
): Promise<Map<number, number[]>> {
  if (wardUserIds.length === 0) return new Map();

  const rows = await db
    .select({
      wardUserId: userGuardians.wardUserId,
      guardianUserId: userGuardians.guardianUserId,
    })
    .from(userGuardians);

  const map = new Map<number, number[]>();
  for (const row of rows) {
    if (!wardUserIds.includes(row.wardUserId)) continue;
    const list = map.get(row.wardUserId) ?? [];
    list.push(row.guardianUserId);
    map.set(row.wardUserId, list);
  }
  return map;
}

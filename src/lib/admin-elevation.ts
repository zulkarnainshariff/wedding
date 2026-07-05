import { verifyPassword } from "@/lib/auth";
import { db } from "@/lib/db";
import { isAdminRole, roleLevelFromDb } from "@/lib/role-levels";
import { users } from "@/lib/schema";

/** Returns true when the password matches any admin or superuser account. */
export async function verifyAdminElevationPassword(
  password: string,
): Promise<boolean> {
  if (!password) return false;

  const rows = await db
    .select({
      passwordHash: users.passwordHash,
      roleLevel: users.roleLevel,
      isAdmin: users.isAdmin,
    })
    .from(users);

  for (const row of rows) {
    const level = roleLevelFromDb(row.roleLevel, row.isAdmin);
    if (!isAdminRole(level)) continue;
    if (await verifyPassword(password, row.passwordHash)) return true;
  }

  return false;
}

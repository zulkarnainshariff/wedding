import "dotenv/config";
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL!);

type UserRow = {
  id: number;
  permissions: { isWeddingCoordinator?: boolean; canModerateGuestbook?: boolean } | null;
};

async function main() {
  await sql`
    ALTER TABLE guest_list_permissions
    ADD COLUMN IF NOT EXISTS is_wedding_coordinator boolean NOT NULL DEFAULT false
  `;

  await sql`
    ALTER TABLE guest_list_permissions
    ADD COLUMN IF NOT EXISTS can_moderate_guestbook boolean NOT NULL DEFAULT false
  `;

  const events = await sql<{ id: number }[]>`SELECT id FROM wedding_events`;
  const users = await sql<UserRow[]>`SELECT id, permissions FROM users`;

  for (const user of users) {
    const permissions = user.permissions ?? {};
    const isCoordinator = Boolean(permissions.isWeddingCoordinator);
    const canModerate = Boolean(permissions.canModerateGuestbook);
    if (!isCoordinator && !canModerate) continue;

    for (const event of events) {
      const [existing] = await sql<
        {
          id: number;
          can_view: boolean;
          can_edit: boolean;
          is_wedding_coordinator: boolean;
          can_moderate_guestbook: boolean;
        }[]
      >`
        SELECT id, can_view, can_edit, is_wedding_coordinator, can_moderate_guestbook
        FROM guest_list_permissions
        WHERE event_id = ${event.id} AND user_id = ${user.id}
        LIMIT 1
      `;

      if (existing) {
        await sql`
          UPDATE guest_list_permissions
          SET
            can_view = ${existing.can_view || isCoordinator},
            is_wedding_coordinator = ${existing.is_wedding_coordinator || isCoordinator},
            can_moderate_guestbook = ${existing.can_moderate_guestbook || canModerate}
          WHERE id = ${existing.id}
        `;
      } else {
        await sql`
          INSERT INTO guest_list_permissions (
            event_id,
            user_id,
            can_view,
            can_edit,
            is_wedding_coordinator,
            can_moderate_guestbook
          )
          VALUES (
            ${event.id},
            ${user.id},
            ${isCoordinator},
            false,
            ${isCoordinator},
            ${canModerate}
          )
        `;
      }
    }
  }

  console.log("Guest list event roles migration complete.");
  await sql.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

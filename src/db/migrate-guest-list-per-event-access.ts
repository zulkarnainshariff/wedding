import "dotenv/config";
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL!);

type UserRow = {
  id: number;
  permissions: {
    canViewAllGuestLists?: boolean;
    canEditAllGuestLists?: boolean;
    isWeddingCoordinator?: boolean;
    canModerateGuestbook?: boolean;
  } | null;
};

async function main() {
  const events = await sql<{ id: number }[]>`SELECT id FROM wedding_events`;
  const users = await sql<UserRow[]>`SELECT id, permissions FROM users`;

  for (const user of users) {
    const permissions = user.permissions ?? {};
    const canViewAll = Boolean(
      permissions.canViewAllGuestLists || permissions.canEditAllGuestLists,
    );
    const canEditAll = Boolean(permissions.canEditAllGuestLists);
    const isCoordinator = Boolean(permissions.isWeddingCoordinator);
    const canModerate = Boolean(permissions.canModerateGuestbook);

    if (!canViewAll && !canEditAll && !isCoordinator && !canModerate) continue;

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

      const canView = canViewAll || isCoordinator;
      const canEdit = canEditAll;

      if (existing) {
        await sql`
          UPDATE guest_list_permissions
          SET
            can_view = ${existing.can_view || canView},
            can_edit = ${existing.can_edit || canEdit},
            is_wedding_coordinator = ${existing.is_wedding_coordinator || isCoordinator},
            can_moderate_guestbook = ${existing.can_moderate_guestbook || canModerate}
          WHERE id = ${existing.id}
        `;
      } else if (canView || canEdit || isCoordinator || canModerate) {
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
            ${canView},
            ${canEdit},
            ${isCoordinator},
            ${canModerate}
          )
        `;
      }
    }
  }

  console.log("Guest list per-event access migration complete.");
  await sql.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

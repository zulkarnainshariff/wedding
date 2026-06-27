import { redirect } from "next/navigation";
import { asc } from "drizzle-orm";
import { AppShell } from "@/components/layout/AppShell";
import { AdminPanel } from "@/components/admin/AdminPanel";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { canManageUsers, canEditItinerary, isSuperuser, normalizePermissions } from "@/lib/permissions";
import { getDays, getAllItems } from "@/lib/queries";
import { getAllInvitationEvents, getScheduleItemsForEventAdmin } from "@/lib/public-queries";
import { users } from "@/lib/schema";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const sessionUser = await getSessionUser();
  if (
    !sessionUser ||
    !(
      sessionUser.isAdmin ||
      canManageUsers(sessionUser) ||
      canEditItinerary(sessionUser)
    )
  ) {
    redirect("/itinerary");
  }

  const [days, items, invitationEvents] = await Promise.all([
    getDays(),
    getAllItems(),
    getAllInvitationEvents(),
  ]);

  const initialEvents = await Promise.all(
    invitationEvents.map(async (event) => ({
      ...event,
      schedule: await getScheduleItemsForEventAdmin(event.id),
    })),
  );

  const initialUsers = canManageUsers(sessionUser)
    ? (
        await db.select().from(users).orderBy(asc(users.username))
      ).map((user) => ({
        id: user.id,
        username: user.username,
        isAdmin: user.isAdmin,
        permissions: normalizePermissions(user.permissions, user.isAdmin, user.username),
      }))
    : [];

  return (
    <AppShell>
      <AdminPanel
        initialDays={days}
        initialItems={items}
        initialEvents={initialEvents}
        initialUsers={initialUsers}
        showUserManagement={canManageUsers(sessionUser)}
        showFullAdmin={sessionUser.isAdmin}
        showDiagnostics={isSuperuser(sessionUser)}
      />
    </AppShell>
  );
}

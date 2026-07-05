import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { PageShell } from "@/components/layout/PageShell";
import { GuestListClient } from "@/components/guests/GuestListClient";
import { getSessionUser } from "@/lib/auth";
import { getGuestListAccessForUser, hasGuestListPanelAccess } from "@/lib/guest-queries";
import { getAllInvitationEvents } from "@/lib/public-queries";

export const dynamic = "force-dynamic";

export default async function GuestsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/guests");

  const access = await getGuestListAccessForUser(user);
  if (!access.some(hasGuestListPanelAccess)) {
    redirect("/itinerary");
  }

  const events = await getAllInvitationEvents();

  return (
    <AppShell>
      <PageShell eyebrow="Celebrate" title="Guest lists">
        <div className="mx-auto flex w-full max-w-5xl flex-col">
          <GuestListClient events={events} initialAccess={access} />
        </div>
      </PageShell>
    </AppShell>
  );
}

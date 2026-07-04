import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { PageShell } from "@/components/layout/PageShell";
import { InvitationCards } from "@/components/landing/InvitationCards";
import { getSessionUser } from "@/lib/auth";
import { getInvitationEventsForUser } from "@/lib/public-queries";

export const dynamic = "force-dynamic";

export default async function InvitationPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/invitation");

  const events = await getInvitationEventsForUser(user);

  return (
    <AppShell>
      <PageShell eyebrow="Celebrate" title="Invitations">
        <div className="mx-auto flex w-full max-w-5xl flex-col">
          {events.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-stone-300 bg-white/60 p-10 text-center text-stone-500">
              No invitations are linked to your account yet. If you were expecting
              one, please check with the couple or your trip coordinator.
            </p>
          ) : (
            <InvitationCards events={events} centered={false} />
          )}
        </div>
      </PageShell>
    </AppShell>
  );
}

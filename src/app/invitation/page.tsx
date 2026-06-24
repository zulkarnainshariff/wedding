import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { PageShell } from "@/components/layout/PageShell";
import { InvitationCards } from "@/components/landing/InvitationCards";
import { getSessionUser } from "@/lib/auth";
import { getInvitationEventsWithSchedules } from "@/lib/public-queries";

export const dynamic = "force-dynamic";

export default async function InvitationPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/invitation");

  const events = await getInvitationEventsWithSchedules();

  return (
    <AppShell>
      <PageShell eyebrow="Celebrate" title="Invitations">
        <div className="mx-auto flex w-full max-w-5xl flex-col">
          <InvitationCards events={events} centered={false} />
        </div>
      </PageShell>
    </AppShell>
  );
}

import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { PageShell } from "@/components/layout/PageShell";
import { SettingsForm } from "@/components/settings/SettingsForm";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  return (
    <AppShell>
      <PageShell eyebrow="Account" title="Settings">
        <SettingsForm initialPreferences={user.preferences} />
      </PageShell>
    </AppShell>
  );
}

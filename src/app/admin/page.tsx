import { AppShell } from "@/components/layout/AppShell";
import { AdminPanel } from "@/components/admin/AdminPanel";
import { getDays, getAllItems } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const [days, items] = await Promise.all([getDays(), getAllItems()]);

  return (
    <AppShell>
      <AdminPanel initialDays={days} initialItems={items} />
    </AppShell>
  );
}

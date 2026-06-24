import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { PageShell } from "@/components/layout/PageShell";
import { TasksPanel } from "@/components/tasks/TasksPanel";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function TasksPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/tasks");

  return (
    <AppShell>
      <PageShell eyebrow="Organize" title="Tasks">
        <div className="mx-auto flex w-full max-w-5xl flex-col">
          <Suspense fallback={<p className="text-sm text-stone-500">Loading tasks…</p>}>
            <TasksPanel />
          </Suspense>
        </div>
      </PageShell>
    </AppShell>
  );
}

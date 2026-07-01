import { redirect } from "next/navigation";
import { DocumentsPanel } from "@/components/itinerary/DocumentsPanel";
import { PageShell } from "@/components/layout/PageShell";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function DocumentsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/itinerary/documents");

  return (
    <PageShell eyebrow="Itinerary" title="Documents">
      <DocumentsPanel />
    </PageShell>
  );
}

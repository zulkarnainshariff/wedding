import { PageShell } from "@/components/layout/PageShell";
import { DayTimeline } from "@/components/itinerary/DayTimeline";
import { ScheduleToolbar } from "@/components/itinerary/ScheduleToolbar";
import { getTimeline } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function ItineraryPage() {
  const days = await getTimeline();

  return (
    <PageShell
      eyebrow="Full itinerary"
      title="View All"
      toolbar={<ScheduleToolbar />}
    >
      <DayTimeline days={days} />
    </PageShell>
  );
}

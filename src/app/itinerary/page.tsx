import { ItineraryViewAll } from "@/components/itinerary/ItineraryViewAll";
import { getTimeline } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function ItineraryPage() {
  const days = await getTimeline();

  return <ItineraryViewAll days={days} />;
}

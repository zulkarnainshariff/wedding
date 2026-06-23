import { DayTimeline } from "@/components/itinerary/DayTimeline";
import { getTimeline } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function ItineraryPage() {
  const days = await getTimeline();

  return (
    <div>
      <header className="mb-8">
        <p className="text-xs font-semibold tracking-[0.2em] text-[#d4a853] uppercase">
          Full itinerary
        </p>
        <h1 className="mt-1 font-serif text-3xl text-[#1e3a5f]">View All</h1>
        <p className="mt-2 max-w-2xl text-stone-500">
          Day-by-day schedule from departure to return. Tap any item for booking
          details.
        </p>
      </header>

      <DayTimeline days={days} />
    </div>
  );
}

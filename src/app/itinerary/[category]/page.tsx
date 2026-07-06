import { notFound, redirect } from "next/navigation";
import { CategoryList } from "@/components/itinerary/CategoryList";
import { FlightsPanel } from "@/components/itinerary/FlightsPanel";
import { ScheduleByDate } from "@/components/itinerary/ScheduleByDate";
import { getSessionUser } from "@/lib/auth";
import { canViewCategory } from "@/lib/permissions";
import { getItemsByCategory, getAllItems, getScheduleByDate } from "@/lib/queries";
import { TravelInsuranceItinerary } from "@/components/itinerary/TravelInsuranceItinerary";
import { isCategory } from "@/lib/types";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ category: string }> };
type Search = { searchParams: Promise<{ tab?: string }> };

export default async function CategoryPage({ params, searchParams }: Params & Search) {
  const { category } = await params;
  const { tab } = await searchParams;

  if (!isCategory(category)) {
    notFound();
  }

  if (category === "pet_relocation") {
    redirect("/itinerary/flight?tab=pet_relocation");
  }

  const user = await getSessionUser();
  if (user && !canViewCategory(user, category)) {
    if (category === "flight" && canViewCategory(user, "pet_relocation")) {
      // allowed via combined flights hub
    } else {
      redirect("/itinerary");
    }
  }

  if (category === "activity") {
    const days = await getScheduleByDate();
    return <ScheduleByDate days={days} />;
  }

  if (category === "flight") {
    const [passengerItems, petItems] = await Promise.all([
      getItemsByCategory("flight"),
      getItemsByCategory("pet_relocation"),
    ]);
    const initialTab =
      tab === "pet_relocation"
        ? "pet_relocation"
        : tab === "flight"
          ? "flight"
          : "all";

    return (
      <FlightsPanel
        passengerItems={passengerItems}
        petItems={petItems}
        initialTab={initialTab}
      />
    );
  }

  if (category === "travel_insurance") {
    const [items, allItems] = await Promise.all([
      getItemsByCategory("travel_insurance"),
      getAllItems(),
    ]);
    return <TravelInsuranceItinerary items={items} allItems={allItems} />;
  }

  const items = await getItemsByCategory(category);

  return <CategoryList category={category} items={items} />;
}

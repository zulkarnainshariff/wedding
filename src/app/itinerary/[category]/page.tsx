import { notFound, redirect } from "next/navigation";
import { CategoryList } from "@/components/itinerary/CategoryList";
import { FlightsPanel } from "@/components/itinerary/FlightsPanel";
import { ScheduleByDate } from "@/components/itinerary/ScheduleByDate";
import { getSessionUser } from "@/lib/auth";
import { getItemCategories } from "@/lib/app-categories";
import { canViewCategory } from "@/lib/permissions";
import { getItemsByCategory, getAllItems, getScheduleByDate } from "@/lib/queries";
import { TravelInsuranceItinerary } from "@/components/itinerary/TravelInsuranceItinerary";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ category: string }> };
type Search = { searchParams: Promise<{ tab?: string }> };

export default async function CategoryPage({ params, searchParams }: Params & Search) {
  const { category } = await params;
  const { tab } = await searchParams;
  const itemCategories = await getItemCategories();
  const categoryRow = itemCategories.find((entry) => entry.slug === category);

  if (!categoryRow) {
    notFound();
  }

  const config = (categoryRow.pageBehaviorConfig ?? {}) as {
    targetSlug?: string;
    tab?: string;
  };

  if (categoryRow.pageBehavior === "redirect" && config.targetSlug) {
    const query = config.tab ? `?tab=${config.tab}` : "";
    redirect(`/itinerary/${config.targetSlug}${query}`);
  }

  const user = await getSessionUser();
  if (user && !canViewCategory(user, category)) {
    if (category === "flight" && canViewCategory(user, "pet_relocation")) {
      // allowed via combined flights hub
    } else {
      redirect("/itinerary");
    }
  }

  if (categoryRow.pageBehavior === "schedule") {
    const days = await getScheduleByDate();
    return <ScheduleByDate days={days} />;
  }

  if (categoryRow.pageBehavior === "flights_hub") {
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

  if (categoryRow.pageBehavior === "travel_insurance") {
    const [items, allItems] = await Promise.all([
      getItemsByCategory("travel_insurance"),
      getAllItems(),
    ]);
    return <TravelInsuranceItinerary items={items} allItems={allItems} />;
  }

  const items = await getItemsByCategory(category);

  return <CategoryList category={category} items={items} />;
}

import { notFound, redirect } from "next/navigation";
import { CategoryList } from "@/components/itinerary/CategoryList";
import { ScheduleByDate } from "@/components/itinerary/ScheduleByDate";
import { getSessionUser } from "@/lib/auth";
import { canViewCategory } from "@/lib/permissions";
import { getItemsByCategory, getScheduleByDate } from "@/lib/queries";
import { isCategory } from "@/lib/types";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ category: string }> };

export default async function CategoryPage({ params }: Params) {
  const { category } = await params;

  if (!isCategory(category)) {
    notFound();
  }

  const user = await getSessionUser();
  if (user && !canViewCategory(user, category)) {
    redirect("/itinerary");
  }

  if (category === "activity") {
    const days = await getScheduleByDate();
    return <ScheduleByDate days={days} />;
  }

  const items = await getItemsByCategory(category);

  return <CategoryList category={category} items={items} />;
}

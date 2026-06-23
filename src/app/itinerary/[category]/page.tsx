import { notFound } from "next/navigation";
import { CategoryList } from "@/components/itinerary/CategoryList";
import { getItemsByCategory } from "@/lib/queries";
import { isCategory } from "@/lib/types";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ category: string }> };

export default async function CategoryPage({ params }: Params) {
  const { category } = await params;

  if (!isCategory(category)) {
    notFound();
  }

  const items = await getItemsByCategory(category);

  return <CategoryList category={category} items={items} />;
}

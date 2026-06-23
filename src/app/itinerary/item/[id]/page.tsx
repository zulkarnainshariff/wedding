import { notFound } from "next/navigation";
import { ItemDetailView } from "@/components/itinerary/ItemDetail";
import { getItemById } from "@/lib/queries";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export default async function ItemPage({ params }: Params) {
  const { id } = await params;
  const item = await getItemById(Number(id));

  if (!item) {
    notFound();
  }

  return <ItemDetailView item={item} />;
}

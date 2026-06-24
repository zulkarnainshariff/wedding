import { redirect } from "next/navigation";

type Params = { params: Promise<{ id: string }> };

export default async function ItemPage({ params }: Params) {
  const { id } = await params;
  redirect(`/itinerary?item=${id}`);
}

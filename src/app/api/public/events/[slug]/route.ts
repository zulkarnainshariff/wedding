import { NextResponse } from "next/server";
import {
  getPublishedEventBySlug,
  getPublishedScheduleForEvent,
} from "@/lib/public-queries";

type Params = { params: Promise<{ slug: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { slug } = await params;
  const event = await getPublishedEventBySlug(slug);

  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const schedule = await getPublishedScheduleForEvent(event.id);
  return NextResponse.json({ event, schedule });
}

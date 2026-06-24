import { NextResponse } from "next/server";
import { getPublishedInvitationEvents } from "@/lib/public-queries";

export async function GET() {
  const events = await getPublishedInvitationEvents();
  return NextResponse.json(events);
}

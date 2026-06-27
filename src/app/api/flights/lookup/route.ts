import { NextResponse } from "next/server";
import { isAuthError, requireEditAccess } from "@/lib/api-auth";
import { lookupFlightSchedule } from "@/lib/flight-schedule-lookup";

export async function POST(request: Request) {
  const user = await requireEditAccess();
  if (isAuthError(user)) return user;

  const body = (await request.json()) as {
    operatingFlightNumber?: string;
    flightDate?: string;
    depIata?: string;
    arrIata?: string;
  };

  const result = await lookupFlightSchedule({
    operatingFlightNumber: body.operatingFlightNumber ?? "",
    flightDate: body.flightDate ?? "",
    depIata: body.depIata,
    arrIata: body.arrIata,
  });

  return NextResponse.json(result);
}

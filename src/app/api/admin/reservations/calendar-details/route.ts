import { NextResponse } from "next/server";

import { HttpError, requireFeature } from "@/lib/server/auth";
import { getCalendarReservationDetails } from "@/lib/server/calendar-reservation-details";
import type { CalendarReservationDetailsResponse } from "@/lib/calendar/reservation-details";

export const dynamic = "force-dynamic";

const cacheHeaders = {
  "Cache-Control": "private, no-store",
};

const parseReservationIds = (value: string | null) => {
  if (!value) return [];
  return Array.from(
    new Set(value.split(",").map((id) => id.trim()).filter(Boolean)),
  ).sort();
};

export async function GET(request: Request) {
  try {
    await requireFeature(request, "calendar");
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json(
        { message: error.message },
        { status: error.status, headers: cacheHeaders },
      );
    }
    return NextResponse.json(
      { message: "Unauthorized" },
      { status: 401, headers: cacheHeaders },
    );
  }

  const url = new URL(request.url);
  const ids = parseReservationIds(url.searchParams.get("ids"));
  if (ids.length === 0) {
    const body: CalendarReservationDetailsResponse = { data: [] };
    return NextResponse.json(body, { headers: cacheHeaders });
  }

  try {
    const data = await getCalendarReservationDetails(ids);
    const body: CalendarReservationDetailsResponse = { data };
    return NextResponse.json(body, { headers: cacheHeaders });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to load calendar reservation details";
    return NextResponse.json(
      { message },
      { status: 500, headers: cacheHeaders },
    );
  }
}

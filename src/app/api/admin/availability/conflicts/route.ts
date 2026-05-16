import { NextResponse, type NextRequest } from "next/server";

import { HttpError, requireFeature } from "@/lib/server/auth";
import { getAdminReservationConflictingRoomIds } from "@/lib/server/reservation-conflicts";

export const dynamic = "force-dynamic";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const cacheHeaders = {
  "Cache-Control": "private, no-store",
};

const isValidDate = (value: string) =>
  DATE_PATTERN.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));

export async function GET(request: NextRequest) {
  try {
    await requireFeature(request, "reservationCreate");
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
  const checkIn = url.searchParams.get("checkIn") ?? "";
  const checkOut = url.searchParams.get("checkOut") ?? "";
  const excludeBookingId = url.searchParams.get("excludeBookingId") ?? undefined;

  if (!isValidDate(checkIn) || !isValidDate(checkOut) || checkIn >= checkOut) {
    return NextResponse.json(
      { message: "checkIn and checkOut must be valid dates with checkOut after checkIn" },
      { status: 400, headers: cacheHeaders },
    );
  }

  try {
    const roomIds = await getAdminReservationConflictingRoomIds({
      checkIn,
      checkOut,
      excludeBookingId,
    });

    return NextResponse.json(
      { data: { roomIds } },
      { headers: cacheHeaders },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load conflicts";
    return NextResponse.json(
      { message },
      { status: 500, headers: cacheHeaders },
    );
  }
}

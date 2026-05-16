import { NextResponse, type NextRequest } from "next/server";

import { HttpError, requireFeature } from "@/lib/server/auth";
import {
  AdminReservationBookingError,
  getAdminReservationBookingDetails,
} from "@/lib/server/admin-reservation-booking";

export const dynamic = "force-dynamic";

const cacheHeaders = {
  "Cache-Control": "private, no-store",
};

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    await requireFeature(request, "reservations");
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

  const { id } = await context.params;
  const reservationId = id.trim();

  if (!reservationId) {
    return NextResponse.json(
      { message: "Reservation id is required" },
      { status: 400, headers: cacheHeaders },
    );
  }

  try {
    const data = await getAdminReservationBookingDetails(reservationId);
    return NextResponse.json({ data }, { headers: cacheHeaders });
  } catch (error) {
    if (error instanceof AdminReservationBookingError) {
      return NextResponse.json(
        { message: error.message, code: error.code },
        { status: error.statusCode, headers: cacheHeaders },
      );
    }

    const message =
      error instanceof Error ? error.message : "Failed to load reservation";
    return NextResponse.json(
      { message },
      { status: 500, headers: cacheHeaders },
    );
  }
}

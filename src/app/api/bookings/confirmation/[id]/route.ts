import { NextResponse } from "next/server";

import {
  BookingConfirmationError,
  getPublicBookingConfirmation,
} from "@/lib/server/booking-confirmation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE_HEADERS = { "Cache-Control": "no-store" } as const;

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const reservationId = id.trim();

  if (!reservationId) {
    return NextResponse.json(
      { message: "Reservation id is required" },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  try {
    const data = await getPublicBookingConfirmation(reservationId);
    return NextResponse.json({ data }, { headers: NO_STORE_HEADERS });
  } catch (error) {
    if (error instanceof BookingConfirmationError) {
      return NextResponse.json(
        { message: error.message, code: error.code },
        { status: error.statusCode, headers: NO_STORE_HEADERS },
      );
    }

    console.error("Failed to load booking confirmation", error);
    return NextResponse.json(
      { message: "Unable to load booking confirmation right now." },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }
}

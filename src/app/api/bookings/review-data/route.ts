import { NextResponse } from "next/server";

import { getCachedPublicBookingReviewData } from "@/lib/server/booking-review";
import type { PublicBookingReviewDataResponse } from "@/lib/booking/review";

const cacheHeaders = {
  "Cache-Control": "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400",
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const roomTypeIds = url.searchParams
    .getAll("roomTypeId")
    .map((id) => id.trim())
    .filter(Boolean);
  const checkIn = url.searchParams.get("from")?.trim() ?? "";
  const checkOut = url.searchParams.get("to")?.trim() ?? "";

  if (!roomTypeIds.length || !checkIn || !checkOut) {
    return NextResponse.json(
      { data: null, message: "Room type ids and dates are required" } satisfies PublicBookingReviewDataResponse,
      { status: 400, headers: cacheHeaders },
    );
  }

  try {
    const data = await getCachedPublicBookingReviewData({
      roomTypeIds,
      checkIn,
      checkOut,
    });

    return NextResponse.json(
      { data } satisfies PublicBookingReviewDataResponse,
      { headers: cacheHeaders },
    );
  } catch (error) {
    console.error("Failed to load public booking review data", error);
    return NextResponse.json(
      { data: null, message: "Unable to load booking review data right now." } satisfies PublicBookingReviewDataResponse,
      { status: 500, headers: cacheHeaders },
    );
  }
}

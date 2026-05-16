import { NextResponse } from "next/server";

import type { PublicBookingSearchDataResponse } from "@/lib/booking/search";
import { getCachedPublicBookingSearchData } from "@/lib/server/booking-search";

const cacheHeaders = {
  "Cache-Control": "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400",
};

const getLocalDateKey = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;

export async function GET() {
  try {
    const data = await getCachedPublicBookingSearchData(getLocalDateKey());
    return NextResponse.json(
      { data } satisfies PublicBookingSearchDataResponse,
      { headers: cacheHeaders },
    );
  } catch (error) {
    console.error("Failed to load public booking search data", error);
    return NextResponse.json(
      {
        data: {
          roomTypes: [],
          amenities: [],
          ratePlan: null,
          propertyClosures: [],
        },
      } satisfies PublicBookingSearchDataResponse,
      { status: 500, headers: cacheHeaders },
    );
  }
}

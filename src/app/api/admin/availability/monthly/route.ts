import { NextResponse, type NextRequest } from "next/server";

import { HttpError, requireFeature } from "@/lib/server/auth";
import { getCachedMonthlyAvailability } from "@/lib/server/monthly-availability";
import type { RoomTypeAvailability } from "@/data/types";

export const dynamic = "force-dynamic";

type MonthlyAvailabilityResponse = {
  data: RoomTypeAvailability[];
};

const cacheHeaders = {
  "Cache-Control": "private, no-store",
};

const isValidMonthStart = (value: string) =>
  /^\d{4}-\d{2}-01$/.test(value) && !Number.isNaN(Date.parse(value));

const parseRoomTypeIds = (value: string | null) => {
  if (!value) return undefined;
  const ids = Array.from(
    new Set(value.split(",").map((id) => id.trim()).filter(Boolean)),
  ).sort();
  return ids.length > 0 ? ids : undefined;
};

export async function GET(request: NextRequest) {
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
  const monthStart = url.searchParams.get("monthStart") ?? "";
  const roomTypeIds = parseRoomTypeIds(url.searchParams.get("roomTypeIds"));

  if (!isValidMonthStart(monthStart)) {
    return NextResponse.json(
      { message: "monthStart must be a valid YYYY-MM-01 date" },
      { status: 400, headers: cacheHeaders },
    );
  }

  try {
    const data = await getCachedMonthlyAvailability(monthStart, roomTypeIds);
    const body: MonthlyAvailabilityResponse = { data };

    return NextResponse.json(body, { headers: cacheHeaders });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load monthly availability";
    return NextResponse.json(
      { message },
      { status: 500, headers: cacheHeaders },
    );
  }
}

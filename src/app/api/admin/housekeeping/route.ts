import { NextResponse } from "next/server";

import { getAdminHousekeepingData } from "@/lib/server/admin-housekeeping";
import { HttpError, requireFeature } from "@/lib/server/auth";

const cacheHeaders = {
  "Cache-Control": "private, no-store",
};

const defaultDate = () => new Date().toISOString().slice(0, 10);

export async function GET(request: Request) {
  try {
    await requireFeature(request, "housekeeping");

    const url = new URL(request.url);
    const date = url.searchParams.get("date") || defaultDate();
    const data = await getAdminHousekeepingData(date);

    return NextResponse.json({ data }, { headers: cacheHeaders });
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json(
        { message: error.message },
        { status: error.status, headers: cacheHeaders },
      );
    }

    const message =
      error instanceof Error
        ? error.message
        : "Failed to load housekeeping data";
    return NextResponse.json(
      { message },
      { status: 500, headers: cacheHeaders },
    );
  }
}

import { NextResponse } from "next/server";

import { getAdminRoomsData } from "@/lib/server/admin-rooms";
import { HttpError, requireAdminProfile } from "@/lib/server/auth";

const cacheHeaders = {
  "Cache-Control": "private, no-store",
};

export async function GET(request: Request) {
  try {
    await requireAdminProfile(request);
    const data = await getAdminRoomsData();
    return NextResponse.json({ data }, { headers: cacheHeaders });
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json(
        { message: error.message },
        { status: error.status, headers: cacheHeaders },
      );
    }

    const message =
      error instanceof Error ? error.message : "Failed to load rooms";
    return NextResponse.json(
      { message },
      { status: 500, headers: cacheHeaders },
    );
  }
}

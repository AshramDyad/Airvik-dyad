import { NextResponse } from "next/server";

import { getAdminRoomOptions } from "@/lib/server/admin-room-options";
import { HttpError, requireAdminProfile } from "@/lib/server/auth";

const cacheHeaders = {
  "Cache-Control": "private, no-store",
};

export async function GET(request: Request) {
  try {
    await requireAdminProfile(request);
    const data = await getAdminRoomOptions();
    return NextResponse.json({ data }, { headers: cacheHeaders });
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json(
        { message: error.message },
        { status: error.status, headers: cacheHeaders },
      );
    }

    const message =
      error instanceof Error ? error.message : "Failed to load room options";
    return NextResponse.json(
      { message },
      { status: 500, headers: cacheHeaders },
    );
  }
}

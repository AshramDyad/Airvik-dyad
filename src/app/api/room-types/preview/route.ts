import { NextResponse } from "next/server";

import { getCachedRoomTypePreviews } from "@/lib/server/room-type-preview";
import type { RoomTypePreviewResponse } from "@/lib/room-types/preview";

const cacheHeaders = {
  "Cache-Control": "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400",
};

export async function GET() {
  try {
    const data = await getCachedRoomTypePreviews();
    return NextResponse.json(
      { data } satisfies RoomTypePreviewResponse,
      { headers: cacheHeaders },
    );
  } catch (error) {
    console.error("Failed to load room type previews", error);
    return NextResponse.json(
      { data: [] } satisfies RoomTypePreviewResponse,
      { status: 500, headers: cacheHeaders },
    );
  }
}

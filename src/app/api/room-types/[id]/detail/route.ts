import { NextResponse } from "next/server";

import { getCachedPublicRoomTypeDetail } from "@/lib/server/room-type-detail";
import type { PublicRoomTypeDetailResponse } from "@/lib/room-types/detail";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const cacheHeaders = {
  "Cache-Control": "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400",
};

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const roomTypeId = id.trim();

  if (!roomTypeId) {
    return NextResponse.json(
      { data: null, message: "Room type id is required" } satisfies PublicRoomTypeDetailResponse,
      { status: 400, headers: cacheHeaders },
    );
  }

  try {
    const data = await getCachedPublicRoomTypeDetail(roomTypeId);
    if (!data) {
      return NextResponse.json(
        { data: null, message: "Room type not found" } satisfies PublicRoomTypeDetailResponse,
        { status: 404, headers: cacheHeaders },
      );
    }

    return NextResponse.json(
      { data } satisfies PublicRoomTypeDetailResponse,
      { headers: cacheHeaders },
    );
  } catch (error) {
    console.error("Failed to load public room type detail", error);
    return NextResponse.json(
      { data: null, message: "Unable to load room details right now." } satisfies PublicRoomTypeDetailResponse,
      { status: 500, headers: cacheHeaders },
    );
  }
}

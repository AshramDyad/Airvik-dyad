import { NextResponse } from "next/server";

import { getPublicRoomTypeInventory } from "@/lib/server/room-type-inventory";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteContext = {
  params: Promise<{ id: string }>;
};

const NO_STORE_HEADERS = { "Cache-Control": "no-store" } as const;

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const roomTypeId = id.trim();

  if (!roomTypeId) {
    return NextResponse.json(
      { message: "Room type id is required" },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  try {
    const data = await getPublicRoomTypeInventory(roomTypeId);
    return NextResponse.json({ data }, { headers: NO_STORE_HEADERS });
  } catch (error) {
    console.error("Failed to load public room type inventory", error);
    return NextResponse.json(
      { message: "Unable to load room inventory right now." },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }
}

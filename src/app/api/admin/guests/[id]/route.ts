import { NextResponse } from "next/server";

import { HttpError, requireFeature } from "@/lib/server/auth";
import { getGuestProfile } from "@/lib/server/guest-profile";
import type { Guest } from "@/data/types";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type GuestProfileResponse = {
  data: Guest | null;
};

const cacheHeaders = {
  "Cache-Control": "private, no-store",
};

export async function GET(request: Request, context: RouteContext) {
  try {
    await requireFeature(request, "guests");
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

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json(
      { message: "Guest id is required" },
      { status: 400, headers: cacheHeaders },
    );
  }

  try {
    const guest = await getGuestProfile(id);
    if (!guest) {
      return NextResponse.json(
        { message: "Guest not found" },
        { status: 404, headers: cacheHeaders },
      );
    }

    const body: GuestProfileResponse = { data: guest };
    return NextResponse.json(body, { headers: cacheHeaders });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load guest profile";
    return NextResponse.json(
      { message },
      { status: 500, headers: cacheHeaders },
    );
  }
}

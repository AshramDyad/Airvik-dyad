import { NextResponse } from "next/server";

import { HttpError, requireFeature } from "@/lib/server/auth";
import { getGuestsPage } from "@/lib/server/guests";

export const dynamic = "force-dynamic";

const cacheHeaders = {
  "Cache-Control": "private, no-store",
};

const parseNumberParam = (value: string | null): number | undefined => {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? Number.NaN : parsed;
};

export async function GET(request: Request) {
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

  const url = new URL(request.url);
  const limit = parseNumberParam(url.searchParams.get("limit"));
  const offset = parseNumberParam(url.searchParams.get("offset"));
  const query = url.searchParams.get("query") ?? undefined;

  if (Number.isNaN(limit) || Number.isNaN(offset)) {
    return NextResponse.json(
      { message: "limit and offset must be numbers" },
      { status: 400, headers: cacheHeaders },
    );
  }

  try {
    const page = await getGuestsPage({ limit, offset, query });
    return NextResponse.json(page, { headers: cacheHeaders });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load guests";
    return NextResponse.json(
      { message },
      { status: 500, headers: cacheHeaders },
    );
  }
}

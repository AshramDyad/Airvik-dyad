import { NextResponse, type NextRequest } from "next/server";

import { HttpError, requireFeature } from "@/lib/server/auth";

import {
  clampReservationPageParams,
  getCachedReservationsCount,
  getCachedReservationsPage,
  getCachedReservationStatusCounts,
} from "@/server/reservations/cache";
import type { ReservationStatus } from "@/data/types";

type ReservationsApiResponse = {
  data: Awaited<ReturnType<typeof getCachedReservationsPage>>["data"];
  nextOffset: number | null;
  count?: number | null;
  statusCounts: Awaited<ReturnType<typeof getCachedReservationStatusCounts>>;
};

const parseBoolean = (value: string | null): boolean => {
  if (!value) return false;
  return ["1", "true", "yes"].includes(value.toLowerCase());
};

export async function GET(request: NextRequest) {
  try {
    await requireFeature(request, "reservations");
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const limitParam = url.searchParams.get("limit");
  const offsetParam = url.searchParams.get("offset");
  const query = url.searchParams.get("query") ?? undefined;
  const statuses = url.searchParams.getAll("status") as ReservationStatus[];
  const includeCount = parseBoolean(url.searchParams.get("includeCount"));

  const limit = limitParam ? Number(limitParam) : undefined;
  const offset = offsetParam ? Number(offsetParam) : undefined;

  if ((limitParam && Number.isNaN(Number(limitParam))) || (offsetParam && Number.isNaN(Number(offsetParam)))) {
    return NextResponse.json(
      { message: "limit and offset must be numbers" },
      { status: 400 }
    );
  }

  try {
    const normalized = clampReservationPageParams({ limit, offset, query, statuses });
    const [page, statusCounts] = await Promise.all([
      getCachedReservationsPage(normalized),
      getCachedReservationStatusCounts(),
    ]);

    let count: number | null | undefined = page.totalCount;
    if (includeCount && (count === null || typeof count === "undefined")) {
      count = await getCachedReservationsCount();
    }

    const body: ReservationsApiResponse = {
      data: page.data,
      nextOffset: page.nextOffset,
      count,
      statusCounts,
    };

    return NextResponse.json(body, {
      headers: {
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load reservations";
    return NextResponse.json({ message }, { status: 500 });
  }
}

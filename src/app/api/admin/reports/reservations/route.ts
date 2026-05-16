import { NextResponse, type NextRequest } from "next/server";

import { HttpError, requireFeature } from "@/lib/server/auth";
import { getReportReservations } from "@/lib/server/report-reservations";
import type { ReportReservationsResponse } from "@/lib/reports/report-reservations";

export const dynamic = "force-dynamic";

const cacheHeaders = {
  "Cache-Control": "private, no-store",
};

function isValidDateParam(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
}

export async function GET(request: NextRequest) {
  try {
    await requireFeature(request, "reports");
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
  const from = url.searchParams.get("from") ?? "";
  const to = url.searchParams.get("to") ?? "";

  if (!isValidDateParam(from) || !isValidDateParam(to) || from > to) {
    return NextResponse.json(
      { message: "from and to must be valid YYYY-MM-DD dates" },
      { status: 400, headers: cacheHeaders },
    );
  }

  try {
    const body: ReportReservationsResponse = await getReportReservations({
      from,
      to,
    });

    return NextResponse.json(body, { headers: cacheHeaders });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load report reservations";
    return NextResponse.json(
      { message },
      { status: 500, headers: cacheHeaders },
    );
  }
}

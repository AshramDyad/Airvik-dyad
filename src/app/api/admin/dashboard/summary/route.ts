import { NextResponse } from "next/server";

import type { DashboardSummaryResponse } from "@/lib/dashboard/summary";
import { HttpError, requireFeature } from "@/lib/server/auth";
import { getDashboardSummaryForDate } from "@/lib/server/dashboard-summary";

export const dynamic = "force-dynamic";

const cacheHeaders = {
  "Cache-Control": "private, no-store",
};

const DATE_PARAM_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const isValidDateParam = (value: string | null): value is string => {
  if (!value || !DATE_PARAM_PATTERN.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};

export async function GET(request: Request) {
  try {
    await requireFeature(request, "dashboard");
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
  const date = url.searchParams.get("date");
  if (!isValidDateParam(date)) {
    return NextResponse.json(
      { message: "date must use YYYY-MM-DD format" },
      { status: 400, headers: cacheHeaders },
    );
  }

  try {
    const data = await getDashboardSummaryForDate(date);
    const body: DashboardSummaryResponse = { data };
    return NextResponse.json(body, { headers: cacheHeaders });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to load dashboard summary";
    return NextResponse.json(
      { message },
      { status: 500, headers: cacheHeaders },
    );
  }
}

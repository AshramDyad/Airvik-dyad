import { NextResponse, type NextRequest } from "next/server";

import { HttpError, requireFeature } from "@/lib/server/auth";
import { createServerSupabaseClient } from "@/integrations/supabase/server";
import {
  DbBookingSummaryRow,
  mapBookingSummaryRow,
} from "@/server/reservations/cache";
import type { BookingSummary } from "@/data/types";

type ExportApiResponse = { arrivals: BookingSummary[]; dispatches: BookingSummary[] };

/** Returns true only if value is a YYYY-MM-DD date string */
function isValidDateParam(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !isNaN(new Date(value).getTime());
}

const PAGE = 1000;
const HARD_CAP = 50_000;

/** Fetches all rows from bookings_summary_view where `column` equals `value`,
 *  paginating in batches of PAGE to bypass the Supabase max_rows cap. */
async function fetchAll(
  column: "check_in_date" | "check_out_date",
  value: string
): Promise<DbBookingSummaryRow[]> {
  const supabase = createServerSupabaseClient();
  const all: DbBookingSummaryRow[] = [];
  let offset = 0;

  while (offset < HARD_CAP) {
    const { data, error } = await supabase
      .from("bookings_summary_view")
      .select("*")
      .eq(column, value)
      .order("booking_id", { ascending: true })
      .range(offset, offset + PAGE - 1);

    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;

    all.push(...(data as DbBookingSummaryRow[]));

    if (data.length < PAGE) break;
    offset += PAGE;
  }

  return all;
}

export async function GET(request: NextRequest) {
  try {
    await requireFeature(request, "reports");
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const arrival = url.searchParams.get("arrival") ?? "";
  const dispatch = url.searchParams.get("dispatch") ?? "";

  if (!isValidDateParam(arrival) || !isValidDateParam(dispatch)) {
    return NextResponse.json(
      { message: "arrival and dispatch must be valid YYYY-MM-DD dates" },
      { status: 400 }
    );
  }

  try {
    const [arrivalRows, dispatchRows] = await Promise.all([
      fetchAll("check_in_date", arrival),
      fetchAll("check_out_date", dispatch),
    ]);

    const body: ExportApiResponse = {
      arrivals: arrivalRows.map(mapBookingSummaryRow),
      dispatches: dispatchRows.map(mapBookingSummaryRow),
    };

    return NextResponse.json(body, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to export bookings";
    return NextResponse.json({ message }, { status: 500 });
  }
}

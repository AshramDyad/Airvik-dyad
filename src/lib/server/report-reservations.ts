import "server-only";

import { createServerSupabaseClient } from "@/integrations/supabase/server";
import type { ReservationStatus } from "@/data/types";
import type {
  ReportReservation,
  ReportReservationsResponse,
} from "@/lib/reports/report-reservations";

export const REPORT_RESERVATION_SELECT_COLUMNS =
  "id, check_in_date, check_out_date, status, total_amount" as const;

type DbReportReservationRow = {
  id: string;
  check_in_date: string;
  check_out_date: string;
  status: ReservationStatus;
  total_amount: number;
};

type GetReportReservationsArgs = {
  from: string;
  to: string;
};

const PAGE_SIZE = 1000;
const HARD_CAP = 50_000;

const mapReportReservation = (
  row: DbReportReservationRow,
): ReportReservation => ({
  id: row.id,
  checkInDate: row.check_in_date,
  checkOutDate: row.check_out_date,
  status: row.status,
  totalAmount: row.total_amount,
});

export async function getReportReservations({
  from,
  to,
}: GetReportReservationsArgs): Promise<ReportReservationsResponse> {
  const supabase = createServerSupabaseClient();
  const rows: DbReportReservationRow[] = [];
  let offset = 0;

  const {
    count: roomsForSaleCount,
    error: roomsError,
  } = await supabase
    .from("rooms")
    .select("id", { count: "exact", head: true })
    .neq("status", "Maintenance");

  if (roomsError) {
    throw new Error(roomsError.message);
  }

  while (offset < HARD_CAP) {
    const { data, error } = await supabase
      .from("reservations")
      .select(REPORT_RESERVATION_SELECT_COLUMNS)
      .neq("status", "Cancelled")
      .lte("check_in_date", to)
      .gte("check_out_date", from)
      .order("check_in_date", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      throw new Error(error.message);
    }

    const pageRows = (data ?? []) as DbReportReservationRow[];
    rows.push(...pageRows);

    if (pageRows.length < PAGE_SIZE) {
      break;
    }

    offset += PAGE_SIZE;
  }

  return {
    data: rows.map(mapReportReservation),
    roomsForSaleCount: roomsForSaleCount ?? 0,
  };
}

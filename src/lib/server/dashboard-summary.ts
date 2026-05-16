import "server-only";

import type { ReservationStatus } from "@/data/types";
import { createServerSupabaseClient } from "@/integrations/supabase/server";
import type {
  DashboardSummaryPayload,
  DashboardSummaryRow,
} from "@/lib/dashboard/summary";

export const DASHBOARD_OCCUPANCY_SELECT_COLUMNS =
  "id, room_id, status" as const;

export const DASHBOARD_TODAY_RESERVATION_SELECT_COLUMNS =
  "id, booking_id, guest_id, room_id, check_in_date, check_out_date, status, guest:guests(first_name,last_name,email), room:rooms(room_number)" as const;

const ACTIVE_OCCUPANCY_STATUSES = [
  "Confirmed",
  "Checked-in",
] as const satisfies ReservationStatus[];

const EXCLUDED_TODAY_STATUSES = '("Cancelled","No-show")' as const;

type DbDashboardOccupancyRow = {
  id: string;
  room_id: string | null;
  status: ReservationStatus;
};

type DbDashboardTodayReservationRow = {
  id: string;
  booking_id: string | null;
  guest_id: string;
  room_id: string;
  check_in_date: string;
  check_out_date: string;
  status: ReservationStatus;
  guest?: {
    first_name: string | null;
    last_name: string | null;
    email: string | null;
  } | null;
  room?: {
    room_number: string | null;
  } | null;
};

const formatName = (...parts: Array<string | null | undefined>) =>
  parts
    .filter((part): part is string => Boolean(part && part.trim()))
    .join(" ")
    .trim();

const mapDashboardSummaryRow = (
  row: DbDashboardTodayReservationRow,
): DashboardSummaryRow => ({
  id: row.id,
  guestName:
    formatName(row.guest?.first_name, row.guest?.last_name) ||
    "Unknown Guest",
  guestEmail: row.guest?.email?.trim() || undefined,
  roomNumber: row.room?.room_number || "N/A",
  status: row.status,
});

const sortRowsByRoomThenName = (
  left: DashboardSummaryRow,
  right: DashboardSummaryRow,
) =>
  left.roomNumber.localeCompare(right.roomNumber, undefined, {
    numeric: true,
    sensitivity: "base",
  }) || left.guestName.localeCompare(right.guestName);

export async function getDashboardSummaryForDate(
  date: string,
): Promise<DashboardSummaryPayload> {
  const supabase = createServerSupabaseClient();

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

  const { data: occupancyData, error: occupancyError } = await supabase
    .from("reservations")
    .select(DASHBOARD_OCCUPANCY_SELECT_COLUMNS)
    .in("status", [...ACTIVE_OCCUPANCY_STATUSES])
    .lte("check_in_date", date)
    .gt("check_out_date", date);

  if (occupancyError) {
    throw new Error(occupancyError.message);
  }

  const { data: todayData, error: todayError } = await supabase
    .from("reservations")
    .select(DASHBOARD_TODAY_RESERVATION_SELECT_COLUMNS)
    .or(`check_in_date.eq.${date},check_out_date.eq.${date}`)
    .not("status", "in", EXCLUDED_TODAY_STATUSES)
    .order("check_in_date", { ascending: true });

  if (todayError) {
    throw new Error(todayError.message);
  }

  const occupiedRoomIds = new Set(
    ((occupancyData ?? []) as DbDashboardOccupancyRow[])
      .map((row) => row.room_id)
      .filter((roomId): roomId is string => Boolean(roomId)),
  );
  const roomsForSale = roomsForSaleCount ?? 0;
  const occupiedRoomsCount = occupiedRoomIds.size;
  const todayRows = (todayData ?? []) as unknown as DbDashboardTodayReservationRow[];
  const arrivalsRows = todayRows
    .filter((row) => row.check_in_date === date)
    .map(mapDashboardSummaryRow)
    .sort(sortRowsByRoomThenName);
  const departuresRows = todayRows
    .filter((row) => row.check_out_date === date)
    .map(mapDashboardSummaryRow)
    .sort(sortRowsByRoomThenName);

  return {
    occupancyPercentage: roomsForSale
      ? (occupiedRoomsCount / roomsForSale) * 100
      : 0,
    occupiedRoomsCount,
    availableRooms: Math.max(roomsForSale - occupiedRoomsCount, 0),
    arrivalsRows,
    departuresRows,
    roomsForSaleCount: roomsForSale,
  };
}

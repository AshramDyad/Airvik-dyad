import "server-only";

import { createServerSupabaseClient } from "@/integrations/supabase/server";
import type { ReservationStatus } from "@/data/types";
import type { GuestReservationSummary } from "@/lib/guests/reservations";

export const GUEST_RESERVATION_SELECT_COLUMNS =
  "id, booking_id, room_id, status, check_in_date, check_out_date, room:rooms(room_number)" as const;

type DbGuestReservationRow = {
  id: string;
  booking_id: string;
  room_id: string;
  status: ReservationStatus;
  check_in_date: string;
  check_out_date: string;
  room?: {
    room_number: string | null;
  } | null;
};

const mapGuestReservation = (
  row: DbGuestReservationRow,
): GuestReservationSummary => ({
  id: row.id,
  bookingId: row.booking_id,
  roomId: row.room_id,
  status: row.status,
  checkInDate: row.check_in_date,
  checkOutDate: row.check_out_date,
  roomNumber: row.room?.room_number ?? "N/A",
});

export async function getGuestReservations(
  guestId: string,
): Promise<GuestReservationSummary[]> {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("reservations")
    .select(GUEST_RESERVATION_SELECT_COLUMNS)
    .eq("guest_id", guestId)
    .order("check_in_date", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as unknown as DbGuestReservationRow[]).map(
    mapGuestReservation,
  );
}

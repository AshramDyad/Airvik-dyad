import "server-only";

import { createServerSupabaseClient } from "@/integrations/supabase/server";
import type { ReservationStatus } from "@/data/types";
import type { CalendarReservationDetail } from "@/lib/calendar/reservation-details";

export const CALENDAR_RESERVATION_DETAIL_SELECT_COLUMNS =
  "id, booking_id, guest_id, room_id, check_in_date, check_out_date, number_of_guests, status, booking_date, adult_count, child_count, guest:guests(first_name,last_name,email,phone), room:rooms(room_number, room_type:room_types(name))" as const;

type DbCalendarGuest = {
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
};

type DbCalendarRoom = {
  room_number: string | null;
  room_type?: {
    name: string | null;
  } | null;
};

type DbCalendarReservationDetail = {
  id: string;
  booking_id: string | null;
  guest_id: string;
  room_id: string;
  check_in_date: string;
  check_out_date: string;
  number_of_guests: number | null;
  status: ReservationStatus;
  booking_date: string;
  adult_count: number | null;
  child_count: number | null;
  guest?: DbCalendarGuest | null;
  room?: DbCalendarRoom | null;
};

const normalizeIds = (ids: string[]) =>
  Array.from(new Set(ids.map((id) => id.trim()).filter(Boolean))).sort();

const mapCalendarReservationDetail = (
  row: DbCalendarReservationDetail,
): CalendarReservationDetail => ({
  id: row.id,
  bookingId: row.booking_id ?? row.id,
  guestId: row.guest_id,
  roomId: row.room_id,
  checkInDate: row.check_in_date,
  checkOutDate: row.check_out_date,
  numberOfGuests: row.number_of_guests ?? 0,
  status: row.status,
  bookingDate: row.booking_date,
  adultCount: row.adult_count ?? row.number_of_guests ?? 0,
  childCount: row.child_count ?? 0,
  guestSnapshot: {
    firstName: row.guest?.first_name ?? null,
    lastName: row.guest?.last_name ?? null,
    email: row.guest?.email ?? null,
    phone: row.guest?.phone ?? null,
  },
  roomNumber: row.room?.room_number ?? undefined,
  roomTypeName: row.room?.room_type?.name ?? undefined,
});

export async function getCalendarReservationDetails(
  reservationIds: string[],
): Promise<CalendarReservationDetail[]> {
  const ids = normalizeIds(reservationIds);
  if (ids.length === 0) {
    return [];
  }

  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("reservations")
    .select(CALENDAR_RESERVATION_DETAIL_SELECT_COLUMNS)
    .in("id", ids)
    .order("check_in_date", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as unknown as DbCalendarReservationDetail[]).map(
    mapCalendarReservationDetail,
  );
}

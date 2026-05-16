import "server-only";

import { createServerSupabaseClient } from "@/integrations/supabase/server";

export const RESERVATION_CONFLICT_ROOM_SELECT = "room_id" as const;

export type ReservationConflictInput = {
  checkIn: string;
  checkOut: string;
};

type DbReservationConflictRoom = {
  room_id: string | null;
};

type QueryResponse<T> = {
  data: T[] | null;
  error: unknown;
};

export async function getAdminReservationConflictingRoomIds({
  checkIn,
  checkOut,
}: ReservationConflictInput): Promise<string[]> {
  const supabase = createServerSupabaseClient();
  const { data, error } = (await supabase
    .from("reservations")
    .select(RESERVATION_CONFLICT_ROOM_SELECT)
    .neq("status", "Cancelled")
    .neq("status", "No-show")
    .lt("check_in_date", checkOut)
    .gt("check_out_date", checkIn)) as QueryResponse<DbReservationConflictRoom>;

  if (error) {
    throw new Error("Failed to load reservation conflicts");
  }

  return Array.from(
    new Set(
      (data ?? [])
        .map((row) => row.room_id)
        .filter((roomId): roomId is string => Boolean(roomId)),
    ),
  );
}

import type { Reservation } from "@/data/types";
import { sortReservationsByBookingDate } from "./sort";

export function replaceBookingReservations(current: Reservation[], bookingId: string, saved: Reservation[]): Reservation[] {
  return sortReservationsByBookingDate([...current.filter((row) => row.bookingId !== bookingId), ...saved]);
}

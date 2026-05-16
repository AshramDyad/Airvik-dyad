import type { Reservation } from "@/data/types";

export type ResolveBookingReservationsArgs = {
  reservation: Reservation | null;
  contextReservations: Reservation[];
  fetchedReservations: Reservation[] | null;
};

export function resolveBookingReservations({
  reservation,
  contextReservations,
  fetchedReservations,
}: ResolveBookingReservationsArgs): Reservation[] {
  if (fetchedReservations && fetchedReservations.length > 0) {
    return fetchedReservations;
  }

  if (!reservation) {
    return [];
  }

  const grouped = contextReservations.filter(
    (item) => item.bookingId === reservation.bookingId,
  );

  if (grouped.length > 0) {
    return grouped;
  }

  return [reservation];
}

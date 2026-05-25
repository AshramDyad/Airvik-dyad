import type { BookingSummary, Reservation } from "@/data/types";

export type BookingGroupSource =
  | "active-booking-reservations"
  | "booking-summary"
  | "reservations"
  | "none";

export type ResolvedBookingGroup = {
  selectedReservation: Reservation | null;
  bookingReservations: Reservation[];
  source: BookingGroupSource;
  hasCompleteGroup: boolean;
};

type ResolveBookingGroupInput = {
  reservationId: string;
  activeBookingReservations: Reservation[];
  reservations: Reservation[];
  bookings: BookingSummary[];
};

type ReservationGroupMatch = {
  selectedReservation: Reservation;
  bookingReservations: Reservation[];
};

function findReservationGroup(
  reservationId: string,
  reservations: Reservation[]
): ReservationGroupMatch | null {
  const selectedReservation = reservations.find(
    (entry) => entry.id === reservationId
  );

  if (!selectedReservation) {
    return null;
  }

  return {
    selectedReservation,
    bookingReservations: reservations.filter(
      (entry) => entry.bookingId === selectedReservation.bookingId
    ),
  };
}

function findBookingSummaryGroup(
  reservationId: string,
  bookings: BookingSummary[]
): ReservationGroupMatch | null {
  for (const booking of bookings) {
    const selectedReservation = booking.subRows.find(
      (entry) => entry.id === reservationId
    );

    if (selectedReservation) {
      return {
        selectedReservation,
        bookingReservations: [...booking.subRows],
      };
    }
  }

  return null;
}

export function resolveBookingGroup({
  reservationId,
  activeBookingReservations,
  reservations,
  bookings,
}: ResolveBookingGroupInput): ResolvedBookingGroup {
  if (!reservationId) {
    return {
      selectedReservation: null,
      bookingReservations: [],
      source: "none",
      hasCompleteGroup: false,
    };
  }

  const activeBookingMatch = findReservationGroup(
    reservationId,
    activeBookingReservations
  );
  if (activeBookingMatch) {
    return {
      ...activeBookingMatch,
      source: "active-booking-reservations",
      hasCompleteGroup: true,
    };
  }

  const bookingSummaryMatch = findBookingSummaryGroup(reservationId, bookings);
  if (bookingSummaryMatch) {
    return {
      ...bookingSummaryMatch,
      source: "booking-summary",
      hasCompleteGroup: true,
    };
  }

  const reservationMatch = findReservationGroup(reservationId, reservations);
  if (reservationMatch) {
    const hasCompleteGroup = reservationMatch.bookingReservations.length > 1;

    return {
      selectedReservation: reservationMatch.selectedReservation,
      bookingReservations: hasCompleteGroup
        ? reservationMatch.bookingReservations
        : [],
      source: "reservations",
      hasCompleteGroup,
    };
  }

  return {
    selectedReservation: null,
    bookingReservations: [],
    source: "none",
    hasCompleteGroup: false,
  };
}

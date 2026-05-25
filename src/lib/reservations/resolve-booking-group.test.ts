import { beforeEach, describe, expect, it } from "vitest";

import type { BookingSummary, Reservation } from "@/data/types";
import { buildReservation, resetBuilderSequences } from "@/test/builders";

import { resolveBookingGroup } from "./resolve-booking-group";

function buildReservationGroup(count: number, bookingId: string): Reservation[] {
  return Array.from({ length: count }, (_, index) =>
    buildReservation({
      id: `reservation-${index + 1}`,
      bookingId,
      roomId: `room-${index + 1}`,
      totalAmount: 9600,
    })
  );
}

function buildBookingSummaryFromReservations(
  reservations: Reservation[]
): BookingSummary {
  const primaryReservation = reservations[0];

  if (!primaryReservation) {
    throw new Error("buildBookingSummaryFromReservations requires rows");
  }

  return {
    id: primaryReservation.id,
    bookingId: primaryReservation.bookingId,
    bookingDate: primaryReservation.bookingDate,
    guestId: primaryReservation.guestId,
    guestName: "Test Guest",
    guestSnapshot: {
      firstName: "Test",
      lastName: "Guest",
      email: "guest@example.com",
      phone: "+1-555-0100",
    },
    totalAmount: reservations.reduce(
      (sum, entry) => sum + entry.totalAmount,
      0
    ),
    roomCount: reservations.length,
    checkInDate: primaryReservation.checkInDate,
    checkOutDate: primaryReservation.checkOutDate,
    numberOfGuests: reservations.reduce(
      (sum, entry) => sum + entry.numberOfGuests,
      0
    ),
    adultCount: reservations.reduce((sum, entry) => sum + entry.adultCount, 0),
    childCount: reservations.reduce((sum, entry) => sum + entry.childCount, 0),
    status: primaryReservation.status,
    source: primaryReservation.source,
    paymentMethod: primaryReservation.paymentMethod,
    nights: 1,
    roomNumber: "101",
    displayAmount: reservations.reduce(
      (sum, entry) => sum + entry.totalAmount,
      0
    ),
    folio: reservations.flatMap((entry) => entry.folio),
    subRows: reservations.map((entry, index) => ({
      ...entry,
      guestName: `Guest ${index + 1}`,
      nights: 1,
      displayAmount: entry.totalAmount,
    })),
  };
}

describe("resolveBookingGroup", () => {
  beforeEach(() => {
    resetBuilderSequences();
  });

  it("returns the full searched booking summary group for the clicked reservation", () => {
    const bookingReservations = buildReservationGroup(7, "A6977");

    const result = resolveBookingGroup({
      reservationId: bookingReservations[3].id,
      activeBookingReservations: [],
      reservations: [],
      bookings: [buildBookingSummaryFromReservations(bookingReservations)],
    });

    expect(result.source).toBe("booking-summary");
    expect(result.selectedReservation?.id).toBe(bookingReservations[3].id);
    expect(result.bookingReservations).toHaveLength(7);
    expect(result.bookingReservations.map((entry) => entry.id)).toEqual(
      bookingReservations.map((entry) => entry.id)
    );
    expect(result.hasCompleteGroup).toBe(true);
  });

  it("prefers the active booking lookup group over searched booking summaries", () => {
    const activeBookingReservations = buildReservationGroup(2, "A6977");
    const searchedBookingReservations = buildReservationGroup(7, "A6977").map(
      (entry, index) => ({
        ...entry,
        id: index === 0 ? activeBookingReservations[0].id : entry.id,
      })
    );

    const result = resolveBookingGroup({
      reservationId: activeBookingReservations[0].id,
      activeBookingReservations,
      reservations: [],
      bookings: [
        buildBookingSummaryFromReservations(searchedBookingReservations),
      ],
    });

    expect(result.source).toBe("active-booking-reservations");
    expect(result.selectedReservation).toBe(activeBookingReservations[0]);
    expect(result.bookingReservations).toEqual(activeBookingReservations);
    expect(result.hasCompleteGroup).toBe(true);
  });

  it("marks a lone flat reservation as incomplete for pending lookup skeletons", () => {
    const selectedReservation = buildReservation({
      id: "reservation-clicked",
      bookingId: "A6977",
    });

    const result = resolveBookingGroup({
      reservationId: selectedReservation.id,
      activeBookingReservations: [],
      reservations: [selectedReservation],
      bookings: [],
    });

    expect(result.source).toBe("reservations");
    expect(result.selectedReservation).toBe(selectedReservation);
    expect(result.bookingReservations).toEqual([]);
    expect(result.hasCompleteGroup).toBe(false);
  });

  it("returns matching flat reservations when they contain the booking group", () => {
    const bookingReservations = buildReservationGroup(3, "A6977");
    const unrelatedReservation = buildReservation({ bookingId: "B1000" });

    const result = resolveBookingGroup({
      reservationId: bookingReservations[1].id,
      activeBookingReservations: [],
      reservations: [unrelatedReservation, ...bookingReservations],
      bookings: [],
    });

    expect(result.source).toBe("reservations");
    expect(result.selectedReservation).toBe(bookingReservations[1]);
    expect(result.bookingReservations).toEqual(bookingReservations);
    expect(result.hasCompleteGroup).toBe(true);
  });
});

import { describe, expect, it } from "vitest";

import { resolveBookingReservations } from "./confirmation";
import type { Reservation } from "@/data/types";

const reservation = {
  id: "reservation-1",
  bookingId: "BOOK-1",
  guestId: "guest-1",
} as Reservation;

const sibling = {
  id: "reservation-2",
  bookingId: "BOOK-1",
  guestId: "guest-1",
} as Reservation;

describe("resolveBookingReservations", () => {
  it("prefers fetched sibling reservations for confirmation display", () => {
    expect(
      resolveBookingReservations({
        reservation,
        contextReservations: [reservation],
        fetchedReservations: [reservation, sibling],
      }),
    ).toEqual([reservation, sibling]);
  });

  it("uses matching context reservations when fetched siblings are not available", () => {
    expect(
      resolveBookingReservations({
        reservation,
        contextReservations: [reservation, sibling],
        fetchedReservations: null,
      }),
    ).toEqual([reservation, sibling]);
  });

  it("falls back to the primary reservation", () => {
    expect(
      resolveBookingReservations({
        reservation,
        contextReservations: [],
        fetchedReservations: [],
      }),
    ).toEqual([reservation]);
  });
});

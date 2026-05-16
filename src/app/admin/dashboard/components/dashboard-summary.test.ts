import { describe, expect, it } from "vitest";

import type { BookingSummary, Room } from "@/data/types";
import { buildDashboardSummary } from "./dashboard-summary";

const todayRange = {
  start: new Date(2026, 4, 13, 0, 0, 0, 0),
  end: new Date(2026, 4, 13, 23, 59, 59, 999),
};

const room = (overrides: Partial<Room>): Room => ({
  id: "room-101",
  roomNumber: "101",
  roomTypeId: "room-type-1",
  status: "Clean",
  ...overrides,
});

const reservation = (
  overrides: Partial<BookingSummary["subRows"][number]> = {},
): BookingSummary["subRows"][number] => ({
  id: "reservation-1",
  bookingId: "booking-1",
  guestId: "guest-1",
  roomId: "room-101",
  ratePlanId: null,
  checkInDate: "2026-05-13",
  checkOutDate: "2026-05-15",
  numberOfGuests: 2,
  status: "Confirmed",
  notes: "",
  folio: [],
  totalAmount: 2000,
  bookingDate: "2026-05-12T10:00:00.000Z",
  source: "reception",
  paymentMethod: "UPI",
  adultCount: 2,
  childCount: 0,
  taxEnabledSnapshot: false,
  taxRateSnapshot: 0,
  guestName: "Room Guest",
  nights: 2,
  ...overrides,
});

const booking = (
  overrides: Partial<BookingSummary> = {},
): BookingSummary => {
  const subRows = overrides.subRows ?? [reservation()];

  return {
    id: "booking-1",
    bookingId: "booking-1",
    bookingDate: "2026-05-12T10:00:00.000Z",
    guestId: "guest-1",
    guestName: "Booking Guest",
    guestSnapshot: {
      firstName: "Booking",
      lastName: "Guest",
      email: "booking@example.com",
      phone: null,
    },
    totalAmount: 2000,
    roomCount: subRows.length,
    checkInDate: subRows[0]?.checkInDate ?? "2026-05-13",
    checkOutDate: subRows[0]?.checkOutDate ?? "2026-05-15",
    numberOfGuests: 2,
    adultCount: 2,
    childCount: 0,
    status: "Confirmed",
    source: "reception",
    paymentMethod: "UPI",
    nights: 2,
    roomNumber: "101",
    displayAmount: 2000,
    folio: [],
    ...overrides,
    subRows,
  };
};

describe("buildDashboardSummary", () => {
  it("uses booking summary guest data for dashboard rows without global guests", () => {
    const summary = buildDashboardSummary({
      bookings: [
        booking({
          guestSnapshot: {
            firstName: "Nirav",
            lastName: "Patel",
            email: "nirav@example.com",
            phone: null,
          },
          subRows: [
            reservation({
              id: "arriving",
              roomId: "room-101",
              guestName: "Room Guest",
              checkInDate: "2026-05-13",
              checkOutDate: "2026-05-15",
              status: "Confirmed",
            }),
          ],
        }),
        booking({
          id: "booking-2",
          bookingId: "booking-2",
          guestId: "guest-2",
          guestName: "",
          guestSnapshot: {
            firstName: "Asha",
            lastName: "Rao",
            email: "asha@example.com",
            phone: null,
          },
          subRows: [
            reservation({
              id: "departing",
              bookingId: "booking-2",
              guestId: "guest-2",
              roomId: "room-102",
              guestName: "",
              checkInDate: "2026-05-10",
              checkOutDate: "2026-05-13",
              status: "Checked-in",
            }),
          ],
        }),
      ],
      rooms: [
        room({ id: "room-101", roomNumber: "101", status: "Clean" }),
        room({ id: "room-102", roomNumber: "102", status: "Dirty" }),
        room({ id: "room-103", roomNumber: "103", status: "Maintenance" }),
      ],
      todayRange,
    });

    expect(summary.arrivalsRows).toEqual([
      {
        id: "arriving",
        guestName: "Room Guest",
        guestEmail: "nirav@example.com",
        roomNumber: "101",
        status: "Confirmed",
      },
    ]);
    expect(summary.departuresRows).toEqual([
      {
        id: "departing",
        guestName: "Asha Rao",
        guestEmail: "asha@example.com",
        roomNumber: "102",
        status: "Checked-in",
      },
    ]);
    expect(summary.occupiedRoomsCount).toBe(2);
    expect(summary.roomsForSaleCount).toBe(2);
    expect(summary.availableRooms).toBe(0);
    expect(summary.occupancyPercentage).toBe(100);
  });
});

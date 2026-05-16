import { describe, expect, it } from "vitest";

import type { Property, Room, RoomType } from "@/data/types";
import {
  buildReservationInvoiceData,
  type ReservationInvoiceRow,
} from "./invoice-data";

const property: Property = {
  id: "property-1",
  name: "Airvik",
  address: "Rishikesh",
  phone: "555",
  email: "stay@example.com",
  logo_url: "",
  photos: [],
  google_maps_url: "",
  timezone: "Asia/Kolkata",
  currency: "INR",
  allowSameDayTurnover: true,
  showPartialDays: true,
  defaultUnitsView: "remaining",
  tax_enabled: false,
  tax_percentage: 0,
};

const room: Room = {
  id: "room-101",
  roomNumber: "101",
  roomTypeId: "room-type-1",
  status: "Clean",
};

const roomType: RoomType = {
  id: "room-type-1",
  name: "Deluxe Room",
  description: "",
  maxOccupancy: 2,
  bedTypes: ["Queen"],
  price: 2000,
  amenities: [],
  photos: [],
  isVisible: true,
};

const reservationRow: ReservationInvoiceRow = {
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
  totalAmount: 4000,
  bookingDate: "2026-05-12T10:00:00.000Z",
  source: "reception",
  paymentMethod: "UPI",
  adultCount: 2,
  childCount: 0,
  taxEnabledSnapshot: false,
  taxRateSnapshot: 0,
  guestSnapshot: {
    firstName: "Asha",
    lastName: "Guest",
    email: "asha@example.com",
    phone: "555",
  },
  guestName: "Asha Guest",
  roomNumber: "101",
  nights: 2,
};

describe("buildReservationInvoiceData", () => {
  it("uses reservation guest snapshots when the index does not preload guests", () => {
    const data = buildReservationInvoiceData(
      { ...reservationRow, subRows: [reservationRow] },
      [],
      property,
      [room],
      [roomType],
    );

    expect(data.guest).toMatchObject({
      id: "guest-1",
      firstName: "Asha",
      lastName: "Guest",
      email: "asha@example.com",
      phone: "555",
    });
    expect(data.reservations).toEqual([reservationRow]);
    expect(data.rooms).toEqual([room]);
    expect(data.roomTypes).toEqual([roomType]);
  });
});

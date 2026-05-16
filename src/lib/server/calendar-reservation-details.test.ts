import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const supabaseMocks = vi.hoisted(() => ({
  createServerSupabaseClient: vi.fn(),
}));

vi.mock("@/integrations/supabase/server", () => supabaseMocks);

import {
  CALENDAR_RESERVATION_DETAIL_SELECT_COLUMNS,
  getCalendarReservationDetails,
} from "./calendar-reservation-details";

const createReservationDetailsQuery = (response: unknown) => {
  const query = {
    from: vi.fn(() => query),
    select: vi.fn(() => query),
    in: vi.fn(() => query),
    order: vi.fn(async () => response),
  };
  return query;
};

describe("calendar reservation detail server data access", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("selects narrow hover detail columns for requested reservation ids", async () => {
    const query = createReservationDetailsQuery({
      data: [
        {
          id: "reservation-1",
          booking_id: "booking-1",
          guest_id: "guest-1",
          room_id: "room-1",
          check_in_date: "2026-05-10",
          check_out_date: "2026-05-12",
          number_of_guests: 2,
          status: "Confirmed",
          booking_date: "2026-05-01T00:00:00.000Z",
          adult_count: 2,
          child_count: 0,
          guest: {
            first_name: "Asha",
            last_name: "Guest",
            email: "asha@example.com",
            phone: "9999999999",
          },
          room: {
            room_number: "101",
            room_type: {
              name: "Deluxe",
            },
          },
        },
      ],
      error: null,
    });
    supabaseMocks.createServerSupabaseClient.mockReturnValue(query);

    await expect(
      getCalendarReservationDetails(["reservation-1", "reservation-1", "reservation-2"]),
    ).resolves.toEqual([
      {
        id: "reservation-1",
        bookingId: "booking-1",
        guestId: "guest-1",
        roomId: "room-1",
        checkInDate: "2026-05-10",
        checkOutDate: "2026-05-12",
        numberOfGuests: 2,
        status: "Confirmed",
        bookingDate: "2026-05-01T00:00:00.000Z",
        adultCount: 2,
        childCount: 0,
        guestSnapshot: {
          firstName: "Asha",
          lastName: "Guest",
          email: "asha@example.com",
          phone: "9999999999",
        },
        roomNumber: "101",
        roomTypeName: "Deluxe",
      },
    ]);

    expect(query.from).toHaveBeenCalledWith("reservations");
    expect(query.select).toHaveBeenCalledWith(
      CALENDAR_RESERVATION_DETAIL_SELECT_COLUMNS,
    );
    expect(query.in).toHaveBeenCalledWith("id", ["reservation-1", "reservation-2"]);
    expect(query.order).toHaveBeenCalledWith("check_in_date", {
      ascending: true,
    });
  });

  it("skips Supabase when no ids are requested", async () => {
    await expect(getCalendarReservationDetails([])).resolves.toEqual([]);

    expect(supabaseMocks.createServerSupabaseClient).not.toHaveBeenCalled();
  });
});

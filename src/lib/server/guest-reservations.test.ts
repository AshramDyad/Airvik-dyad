import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const supabaseMocks = vi.hoisted(() => ({
  createServerSupabaseClient: vi.fn(),
}));

vi.mock("@/integrations/supabase/server", () => supabaseMocks);

import {
  getGuestReservations,
  GUEST_RESERVATION_SELECT_COLUMNS,
} from "./guest-reservations";

const createGuestReservationsQuery = (response: unknown) => {
  const query = {
    from: vi.fn(() => query),
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    order: vi.fn(async () => response),
  };
  return query;
};

describe("guest reservation server data access", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("selects only guest history columns for the requested guest", async () => {
    const query = createGuestReservationsQuery({
      data: [
        {
          id: "reservation-1",
          booking_id: "booking-1",
          room_id: "room-1",
          status: "Confirmed",
          check_in_date: "2026-05-10",
          check_out_date: "2026-05-12",
          room: {
            room_number: "101",
          },
        },
      ],
      error: null,
    });
    supabaseMocks.createServerSupabaseClient.mockReturnValue(query);

    await expect(getGuestReservations("guest-1")).resolves.toEqual([
      {
        id: "reservation-1",
        bookingId: "booking-1",
        roomId: "room-1",
        status: "Confirmed",
        checkInDate: "2026-05-10",
        checkOutDate: "2026-05-12",
        roomNumber: "101",
      },
    ]);

    expect(query.from).toHaveBeenCalledWith("reservations");
    expect(query.select).toHaveBeenCalledWith(GUEST_RESERVATION_SELECT_COLUMNS);
    expect(query.eq).toHaveBeenCalledWith("guest_id", "guest-1");
    expect(query.order).toHaveBeenCalledWith("check_in_date", {
      ascending: false,
    });
  });
});

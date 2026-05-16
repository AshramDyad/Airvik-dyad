import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const supabaseMocks = vi.hoisted(() => ({
  createServerSupabaseClient: vi.fn(),
}));

vi.mock("@/integrations/supabase/server", () => supabaseMocks);

import {
  DASHBOARD_OCCUPANCY_SELECT_COLUMNS,
  DASHBOARD_TODAY_RESERVATION_SELECT_COLUMNS,
  getDashboardSummaryForDate,
} from "./dashboard-summary";

const createRoomCountQuery = (response: unknown) => {
  const query = {
    select: vi.fn(() => query),
    neq: vi.fn(async () => response),
  };
  return query;
};

const createOccupancyQuery = (response: unknown) => {
  const query = {
    select: vi.fn(() => query),
    in: vi.fn(() => query),
    lte: vi.fn(() => query),
    gt: vi.fn(async () => response),
  };
  return query;
};

const createTodayReservationsQuery = (response: unknown) => {
  const query = {
    select: vi.fn(() => query),
    or: vi.fn(() => query),
    not: vi.fn(() => query),
    order: vi.fn(async () => response),
  };
  return query;
};

describe("dashboard summary server data access", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("builds dashboard stats from narrow count and reservation summary queries", async () => {
    const roomCountQuery = createRoomCountQuery({
      data: null,
      error: null,
      count: 3,
    });
    const occupancyQuery = createOccupancyQuery({
      data: [
        { id: "stay-1", room_id: "room-101", status: "Confirmed" },
        { id: "stay-2", room_id: "room-101", status: "Checked-in" },
        { id: "stay-3", room_id: "room-102", status: "Checked-in" },
      ],
      error: null,
    });
    const todayReservationsQuery = createTodayReservationsQuery({
      data: [
        {
          id: "arrival-1",
          booking_id: "booking-1",
          guest_id: "guest-1",
          room_id: "room-101",
          check_in_date: "2026-05-13",
          check_out_date: "2026-05-15",
          status: "Confirmed",
          guest: {
            first_name: "Asha",
            last_name: "Guest",
            email: "asha@example.com",
          },
          room: {
            room_number: "101",
          },
        },
        {
          id: "departure-1",
          booking_id: "booking-2",
          guest_id: "guest-2",
          room_id: "room-102",
          check_in_date: "2026-05-11",
          check_out_date: "2026-05-13",
          status: "Checked-in",
          guest: {
            first_name: "Meera",
            last_name: "Guest",
            email: "meera@example.com",
          },
          room: {
            room_number: "102",
          },
        },
      ],
      error: null,
    });
    const from = vi
      .fn()
      .mockReturnValueOnce(roomCountQuery)
      .mockReturnValueOnce(occupancyQuery)
      .mockReturnValueOnce(todayReservationsQuery);
    supabaseMocks.createServerSupabaseClient.mockReturnValue({ from });

    const summary = await getDashboardSummaryForDate("2026-05-13");

    expect(summary.occupiedRoomsCount).toBe(2);
    expect(summary.roomsForSaleCount).toBe(3);
    expect(summary.availableRooms).toBe(1);
    expect(summary.occupancyPercentage).toBeCloseTo(66.67, 2);
    expect(summary.arrivalsRows).toEqual([
      {
        id: "arrival-1",
        guestName: "Asha Guest",
        guestEmail: "asha@example.com",
        roomNumber: "101",
        status: "Confirmed",
      },
    ]);
    expect(summary.departuresRows).toEqual([
      {
        id: "departure-1",
        guestName: "Meera Guest",
        guestEmail: "meera@example.com",
        roomNumber: "102",
        status: "Checked-in",
      },
    ]);

    expect(from).toHaveBeenNthCalledWith(1, "rooms");
    expect(roomCountQuery.select).toHaveBeenCalledWith("id", {
      count: "exact",
      head: true,
    });
    expect(roomCountQuery.neq).toHaveBeenCalledWith("status", "Maintenance");

    expect(from).toHaveBeenNthCalledWith(2, "reservations");
    expect(occupancyQuery.select).toHaveBeenCalledWith(
      DASHBOARD_OCCUPANCY_SELECT_COLUMNS,
    );
    expect(occupancyQuery.in).toHaveBeenCalledWith("status", [
      "Confirmed",
      "Checked-in",
    ]);
    expect(occupancyQuery.lte).toHaveBeenCalledWith(
      "check_in_date",
      "2026-05-13",
    );
    expect(occupancyQuery.gt).toHaveBeenCalledWith(
      "check_out_date",
      "2026-05-13",
    );

    expect(from).toHaveBeenNthCalledWith(3, "reservations");
    expect(todayReservationsQuery.select).toHaveBeenCalledWith(
      DASHBOARD_TODAY_RESERVATION_SELECT_COLUMNS,
    );
    expect(todayReservationsQuery.or).toHaveBeenCalledWith(
      "check_in_date.eq.2026-05-13,check_out_date.eq.2026-05-13",
    );
    expect(todayReservationsQuery.not).toHaveBeenCalledWith(
      "status",
      "in",
      '("Cancelled","No-show")',
    );
    expect(todayReservationsQuery.order).toHaveBeenCalledWith(
      "check_in_date",
      { ascending: true },
    );
  });
});

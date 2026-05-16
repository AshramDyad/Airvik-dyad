import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const supabaseMocks = vi.hoisted(() => ({
  createServerSupabaseClient: vi.fn(),
}));

vi.mock("@/integrations/supabase/server", () => supabaseMocks);

import {
  getReportReservations,
  REPORT_RESERVATION_SELECT_COLUMNS,
} from "./report-reservations";

const createRoomCountQuery = (response: unknown) => {
  const query = {
    select: vi.fn(() => query),
    neq: vi.fn(async () => response),
  };
  return query;
};

const createReportReservationsQuery = (response: unknown) => {
  const query = {
    select: vi.fn(() => query),
    neq: vi.fn(() => query),
    lte: vi.fn(() => query),
    gte: vi.fn(() => query),
    order: vi.fn(() => query),
    range: vi.fn(async () => response),
  };
  return query;
};

describe("report reservation server data access", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("selects only lean report columns and filters to the requested overlap window", async () => {
    const roomCountQuery = createRoomCountQuery({
      data: null,
      error: null,
      count: 3,
    });
    const reservationsQuery = createReportReservationsQuery({
      data: [
        {
          id: "reservation-1",
          check_in_date: "2026-05-10",
          check_out_date: "2026-05-12",
          status: "Checked-out",
          total_amount: 5000,
        },
      ],
      error: null,
    });
    const from = vi
      .fn()
      .mockReturnValueOnce(roomCountQuery)
      .mockReturnValueOnce(reservationsQuery);
    supabaseMocks.createServerSupabaseClient.mockReturnValue({ from });

    await expect(
      getReportReservations({ from: "2026-05-01", to: "2026-05-31" }),
    ).resolves.toEqual({
      data: [
        {
          id: "reservation-1",
          checkInDate: "2026-05-10",
          checkOutDate: "2026-05-12",
          status: "Checked-out",
          totalAmount: 5000,
        },
      ],
      roomsForSaleCount: 3,
    });

    expect(from).toHaveBeenNthCalledWith(1, "rooms");
    expect(roomCountQuery.select).toHaveBeenCalledWith("id", {
      count: "exact",
      head: true,
    });
    expect(roomCountQuery.neq).toHaveBeenCalledWith("status", "Maintenance");

    expect(from).toHaveBeenNthCalledWith(2, "reservations");
    expect(reservationsQuery.select).toHaveBeenCalledWith(
      REPORT_RESERVATION_SELECT_COLUMNS,
    );
    expect(reservationsQuery.neq).toHaveBeenCalledWith("status", "Cancelled");
    expect(reservationsQuery.lte).toHaveBeenCalledWith(
      "check_in_date",
      "2026-05-31",
    );
    expect(reservationsQuery.gte).toHaveBeenCalledWith(
      "check_out_date",
      "2026-05-01",
    );
    expect(reservationsQuery.order).toHaveBeenCalledWith("check_in_date", {
      ascending: true,
    });
    expect(reservationsQuery.range).toHaveBeenCalledWith(0, 999);
  });
});

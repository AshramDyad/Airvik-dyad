import { beforeEach, describe, expect, it, vi } from "vitest";

import { createServerSupabaseClient } from "@/integrations/supabase/server";
import { requirePermissions } from "@/lib/server/auth";
import { POST } from "./route";

vi.mock("@/integrations/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(),
}));

vi.mock("@/lib/server/auth", () => {
  class HttpError extends Error {
    constructor(public status: number, message: string) {
      super(message);
      this.name = "HttpError";
    }
  }

  return {
    HttpError,
    requirePermissions: vi.fn(),
  };
});

const mockedCreateServerSupabaseClient = vi.mocked(createServerSupabaseClient);
const mockedRequirePermissions = vi.mocked(requirePermissions);

describe("cash booking route", () => {
  beforeEach(() => {
    mockedCreateServerSupabaseClient.mockReset();
    mockedRequirePermissions.mockResolvedValue({
      userId: "reception-1",
      roleName: "Reception",
      permissions: ["create:reservation", "update:reservation"],
    });
  });

  it("requires both reservation create and update permissions", async () => {
    mockedRequirePermissions.mockResolvedValueOnce({
      userId: "reception-1",
      roleName: "Reception",
      permissions: ["create:reservation"],
    });

    const response = await POST(
      new Request("http://localhost/api/admin/reservations/cash-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guestId: "11111111-1111-4111-8111-111111111111",
          roomIds: ["22222222-2222-4222-8222-222222222222"],
          ratePlanId: "33333333-3333-4333-8333-333333333333",
          checkInDate: "2026-05-24",
          checkOutDate: "2026-05-25",
          numberOfGuests: 2,
          adultCount: 2,
          childCount: 0,
          bookingDate: "2026-05-24T08:00:00.000Z",
          cashAmount: 2400,
        }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toEqual({ message: "Insufficient permissions" });
    expect(mockedCreateServerSupabaseClient).not.toHaveBeenCalled();
  });

  it("creates cash reservations and records cash in one RPC", async () => {
    const rpc = vi.fn(async () => ({
      data: [
        {
          id: "reservation-1",
          booking_id: "booking-1",
        },
      ],
      error: null,
    }));
    mockedCreateServerSupabaseClient.mockReturnValue({
      rpc,
    } as unknown as ReturnType<typeof createServerSupabaseClient>);

    const response = await POST(
      new Request("http://localhost/api/admin/reservations/cash-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guestId: "11111111-1111-4111-8111-111111111111",
          roomIds: ["22222222-2222-4222-8222-222222222222"],
          ratePlanId: "33333333-3333-4333-8333-333333333333",
          checkInDate: "2026-05-24",
          checkOutDate: "2026-05-25",
          numberOfGuests: 2,
          adultCount: 2,
          childCount: 0,
          notes: "Front desk cash",
          bookingDate: "2026-05-24T08:00:00.000Z",
          source: "reception",
          taxEnabledSnapshot: true,
          taxRateSnapshot: 12,
          customRoomTotals: [2400],
          cashAmount: 2400.005,
        }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    const permissionsCall = mockedRequirePermissions.mock.calls[0];
    expect(permissionsCall?.[0]).toBeInstanceOf(Request);
    expect(permissionsCall?.[1]).toBe("create:reservation");
    expect(permissionsCall?.[2]).toBe("update:reservation");
    expect(rpc).toHaveBeenCalledWith("create_cash_reservations_with_total", {
      p_booking_id: null,
      p_guest_id: "11111111-1111-4111-8111-111111111111",
      p_room_ids: ["22222222-2222-4222-8222-222222222222"],
      p_rate_plan_id: "33333333-3333-4333-8333-333333333333",
      p_check_in_date: "2026-05-24",
      p_check_out_date: "2026-05-25",
      p_number_of_guests: 2,
      p_notes: "Front desk cash",
      p_booking_date: "2026-05-24T08:00:00.000Z",
      p_source: "reception",
      p_adult_count: 2,
      p_child_count: 0,
      p_tax_enabled_snapshot: true,
      p_tax_rate_snapshot: 12,
      p_custom_totals: [2400],
      p_cash_amount: 2400.01,
      p_actor_user_id: "reception-1",
    });
    expect(body).toEqual({
      reservations: [{ id: "reservation-1", bookingId: "booking-1" }],
    });
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

import { createServerSupabaseClient } from "@/integrations/supabase/server";
import { requirePermission } from "@/lib/server/auth";
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
    requirePermission: vi.fn(),
  };
});

const mockedCreateServerSupabaseClient = vi.mocked(createServerSupabaseClient);
const mockedRequirePermission = vi.mocked(requirePermission);

describe("payment override route", () => {
  beforeEach(() => {
    mockedCreateServerSupabaseClient.mockReset();
    mockedRequirePermission.mockResolvedValue({
      userId: "admin-1",
      roleName: "Administration",
      permissions: ["update:payment"],
    });
  });

  it("requires update payment permission and calls the override RPC", async () => {
    const rpc = vi.fn(async () => ({
      data: {
        id: "folio-override-1",
        reservation_id: "reservation-1",
        description: "Payment - UPI Gateway Override",
        amount: -1200,
        timestamp: "2026-05-24T08:30:00.000Z",
        payment_method: "UPI Gateway",
        transaction_id: "UPI-123",
        external_source: "payment_override",
        external_reference: "UPI-123",
        external_metadata: { reason: "Verified in bank app" },
        received_by: "admin-1",
        received_at: "2026-05-24T08:30:00.000Z",
      },
      error: null,
    }));
    mockedCreateServerSupabaseClient.mockReturnValue({
      rpc,
    } as unknown as ReturnType<typeof createServerSupabaseClient>);

    const response = await POST(
      new Request("http://localhost/api/admin/reservations/reservation-1/payment-override", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: 1200.004,
          reference: " UPI-123 ",
          reason: "Verified in bank app",
        }),
      }),
      { params: Promise.resolve({ id: "reservation-1" }) }
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    const permissionCall = mockedRequirePermission.mock.calls[0];
    expect(permissionCall?.[0]).toBeInstanceOf(Request);
    expect(permissionCall?.[1]).toBe("update:payment");
    expect(rpc).toHaveBeenCalledWith("admin_confirm_gateway_payment_override", {
      p_reservation_id: "reservation-1",
      p_paid_amount: 1200,
      p_payment_reference: "UPI-123",
      p_reason: "Verified in bank app",
      p_actor_user_id: "admin-1",
    });
    expect(body.folioItem).toEqual(
      expect.objectContaining({
        id: "folio-override-1",
        reservationId: "reservation-1",
        paymentMethod: "UPI Gateway",
        externalSource: "payment_override",
        receivedBy: "admin-1",
      })
    );
  });
});

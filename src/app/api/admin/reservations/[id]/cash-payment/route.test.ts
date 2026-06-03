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

type CashFolioRow = {
  id: string;
  reservation_id: string;
  description: string;
  amount: number;
  timestamp: string;
  payment_method: string;
  transaction_id: string | null;
  external_source: string;
  external_reference: string;
  external_metadata: Record<string, unknown>;
  received_by: string;
  received_at: string;
};

const mockedCreateServerSupabaseClient = vi.mocked(createServerSupabaseClient);
const mockedRequirePermission = vi.mocked(requirePermission);

describe("cash payment route", () => {
  beforeEach(() => {
    mockedCreateServerSupabaseClient.mockReset();
    mockedRequirePermission.mockResolvedValue({
      userId: "profile-1",
      roleName: "Reception",
      permissions: ["update:reservation"],
    });
  });

  it("records a cash folio item via the balance-guard RPC", async () => {
    const folioRow: CashFolioRow = {
      id: "folio-1",
      reservation_id: "reservation-1",
      description: "Payment - Cash",
      amount: -500.56,
      timestamp: "2026-06-03T08:30:00.000Z",
      payment_method: "Cash",
      transaction_id: null,
      external_source: "cash_payment",
      external_reference: "cash-reference",
      external_metadata: { actorUserId: "profile-1" },
      received_by: "profile-1",
      received_at: "2026-06-03T08:30:00.000Z",
    };
    const rpc = vi.fn(async () => ({ data: folioRow, error: null }));
    mockedCreateServerSupabaseClient.mockReturnValue(
      { rpc } as unknown as ReturnType<typeof createServerSupabaseClient>
    );

    const response = await POST(
      buildRequest({ amount: 500.555, notes: "Paid at front desk" }),
      { params: Promise.resolve({ id: "reservation-1" }) }
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    const permissionCall = mockedRequirePermission.mock.calls[0];
    expect(permissionCall?.[0]).toBeInstanceOf(Request);
    expect(permissionCall?.[1]).toBe("update:reservation");
    expect(rpc).toHaveBeenCalledWith(
      "record_cash_payment_with_balance_guard",
      expect.objectContaining({
        p_reservation_id: "reservation-1",
        p_paid_amount: 500.56,
        p_actor_user_id: "profile-1",
        p_notes: "Paid at front desk",
      })
    );
    expect(body.folioItem).toEqual(
      expect.objectContaining({
        id: "folio-1",
        reservationId: "reservation-1",
        amount: -500.56,
        paymentMethod: "Cash",
        receivedBy: "profile-1",
      })
    );
  });

  it("forwards a null remark when none is provided", async () => {
    const rpc = vi.fn(async () => ({
      data: buildFolioRow(),
      error: null,
    }));
    mockedCreateServerSupabaseClient.mockReturnValue(
      { rpc } as unknown as ReturnType<typeof createServerSupabaseClient>
    );

    await POST(buildRequest({ amount: 250 }), {
      params: Promise.resolve({ id: "reservation-1" }),
    });

    expect(rpc).toHaveBeenCalledWith(
      "record_cash_payment_with_balance_guard",
      expect.objectContaining({ p_notes: null })
    );
  });

  it("surfaces a balance-guard rejection as a 409", async () => {
    const rpc = vi.fn(async () => ({
      data: null,
      error: { message: "Amount exceeds the outstanding balance." },
    }));
    mockedCreateServerSupabaseClient.mockReturnValue(
      { rpc } as unknown as ReturnType<typeof createServerSupabaseClient>
    );

    const response = await POST(buildRequest({ amount: 9999 }), {
      params: Promise.resolve({ id: "reservation-1" }),
    });
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body).toEqual({ message: "Amount exceeds the outstanding balance." });
  });
});

function buildRequest(body: unknown): Request {
  return new Request("http://localhost/api/admin/reservations/reservation-1/cash-payment", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function buildFolioRow(): CashFolioRow {
  return {
    id: "folio-1",
    reservation_id: "reservation-1",
    description: "Payment - Cash",
    amount: -250,
    timestamp: "2026-06-03T08:30:00.000Z",
    payment_method: "Cash",
    transaction_id: null,
    external_source: "cash_payment",
    external_reference: "cash-reference",
    external_metadata: { actorUserId: "profile-1" },
    received_by: "profile-1",
    received_at: "2026-06-03T08:30:00.000Z",
  };
}

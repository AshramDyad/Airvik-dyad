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

type ReservationRow = {
  id: string;
  status: string;
  payment_method: string | null;
};

type FolioRow = {
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

  it("rejects cash payment on UPI Gateway reservations", async () => {
    const supabase = createCashPaymentSupabaseMock({
      reservation: {
        id: "reservation-1",
        status: "Room Hold",
        payment_method: "UPI Gateway",
      },
    });
    mockedCreateServerSupabaseClient.mockReturnValue(
      supabase.client as unknown as ReturnType<typeof createServerSupabaseClient>
    );

    const response = await POST(buildRequest({ amount: 500 }), {
      params: Promise.resolve({ id: "reservation-1" }),
    });
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body).toEqual({
      message:
        "UPI Gateway reservations must be paid through the linked QR or admin override.",
    });
    expect(supabase.folioInsert).not.toHaveBeenCalled();
  });

  it("records a cash folio item with the current receptionist as receiver", async () => {
    const supabase = createCashPaymentSupabaseMock({
      reservation: {
        id: "reservation-1",
        status: "Confirmed",
        payment_method: "Cash",
      },
    });
    mockedCreateServerSupabaseClient.mockReturnValue(
      supabase.client as unknown as ReturnType<typeof createServerSupabaseClient>
    );

    const response = await POST(buildRequest({ amount: 500.555 }), {
      params: Promise.resolve({ id: "reservation-1" }),
    });
    const body = await response.json();

    expect(response.status).toBe(201);
    const permissionCall = mockedRequirePermission.mock.calls[0];
    expect(permissionCall?.[0]).toBeInstanceOf(Request);
    expect(permissionCall?.[1]).toBe("update:reservation");
    expect(supabase.folioInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        reservation_id: "reservation-1",
        description: "Payment - Cash",
        amount: -500.56,
        payment_method: "Cash",
        external_source: "cash_payment",
        received_by: "profile-1",
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
});

function buildRequest(body: unknown): Request {
  return new Request("http://localhost/api/admin/reservations/reservation-1/cash-payment", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function createCashPaymentSupabaseMock(args: { reservation: ReservationRow | null }) {
  const reservationMaybeSingle = vi.fn(async () => ({
    data: args.reservation,
    error: null,
  }));
  const reservationEq = vi.fn(() => ({ maybeSingle: reservationMaybeSingle }));
  const reservationSelect = vi.fn(() => ({ eq: reservationEq }));

  const folioRow: FolioRow = {
    id: "folio-1",
    reservation_id: "reservation-1",
    description: "Payment - Cash",
    amount: -500.56,
    timestamp: "2026-05-24T08:30:00.000Z",
    payment_method: "Cash",
    transaction_id: null,
    external_source: "cash_payment",
    external_reference: "cash-reference",
    external_metadata: { actorUserId: "profile-1" },
    received_by: "profile-1",
    received_at: "2026-05-24T08:30:00.000Z",
  };
  const folioSingle = vi.fn(async () => ({ data: folioRow, error: null }));
  const folioSelect = vi.fn(() => ({ single: folioSingle }));
  const folioInsert = vi.fn(() => ({ select: folioSelect }));

  const from = vi.fn((table: string): unknown => {
    if (table === "reservations") {
      return { select: reservationSelect };
    }
    if (table === "folio_items") {
      return { insert: folioInsert };
    }
    throw new Error(`Unexpected table ${table}`);
  });

  return {
    client: { from },
    folioInsert,
  };
}

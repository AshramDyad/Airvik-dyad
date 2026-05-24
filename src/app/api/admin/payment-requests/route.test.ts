import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createServerSupabaseClient } from "@/integrations/supabase/server";
import { requireFeature, requirePermissions } from "@/lib/server/auth";
import { createPaymentRequest } from "@/lib/payments/payment-requests-server";
import type { PaymentRequest } from "@/data/types";
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
    requireFeature: vi.fn(),
    requirePermissions: vi.fn(),
  };
});

vi.mock("@/lib/payments/payment-requests-server", () => ({
  createPaymentRequest: vi.fn(),
  listPaymentRequests: vi.fn(),
  reconcilePaymentRequests: vi.fn(),
}));

const RESERVATION_ID = "00000000-0000-0000-0000-000000000201";

type ReservationPaymentMethodRow = {
  id: string;
  payment_method: string | null;
};

const mockedCreateServerSupabaseClient = vi.mocked(createServerSupabaseClient);
const mockedRequireFeature = vi.mocked(requireFeature);
const mockedRequirePermissions = vi.mocked(requirePermissions);
const mockedCreatePaymentRequest = vi.mocked(createPaymentRequest);

describe("payment requests route", () => {
  beforeEach(() => {
    mockedCreateServerSupabaseClient.mockReset();
    mockedRequireFeature.mockReset();
    mockedRequirePermissions.mockReset();
    mockedCreatePaymentRequest.mockReset();

    mockedRequirePermissions.mockResolvedValue({
      userId: "profile-1",
      roleName: "Reception",
      permissions: ["read:payment", "create:reservation", "update:reservation"],
    });
  });

  it("rejects linked payment QR creation for non-gateway reservations", async () => {
    const supabase = createSupabaseMock({
      reservation: {
        id: RESERVATION_ID,
        payment_method: "Cash",
      },
    });
    mockedCreateServerSupabaseClient.mockReturnValue(
      supabase.client as unknown as ReturnType<typeof createServerSupabaseClient>
    );

    const response = await POST(buildRequest({
      amount: 500,
      reservationId: RESERVATION_ID,
    }));
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body).toEqual({
      message: "Payment QR can be generated only for UPI Gateway reservations.",
    });
    expect(mockedCreatePaymentRequest).not.toHaveBeenCalled();
  });

  it("requires full linked payment permissions", async () => {
    mockedRequirePermissions.mockResolvedValueOnce({
      userId: "profile-1",
      roleName: "Reception",
      permissions: ["create:reservation", "update:reservation"],
    });

    const response = await POST(buildRequest({
      amount: 500,
      reservationId: RESERVATION_ID,
    }));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toEqual({ message: "Insufficient permissions" });
    expect(mockedCreateServerSupabaseClient).not.toHaveBeenCalled();
  });

  it("creates linked payment QR for UPI Gateway reservations", async () => {
    const supabase = createSupabaseMock({
      reservation: {
        id: RESERVATION_ID,
        payment_method: "UPI Gateway",
      },
    });
    mockedCreateServerSupabaseClient.mockReturnValue(
      supabase.client as unknown as ReturnType<typeof createServerSupabaseClient>
    );
    mockedCreatePaymentRequest.mockResolvedValue(buildPaymentRequest());

    const response = await POST(buildRequest({
      amount: 500,
      reservationId: RESERVATION_ID,
    }));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(mockedRequirePermissions).toHaveBeenCalledWith(
      expect.any(Request),
      "read:payment",
      "create:reservation",
      "update:reservation"
    );
    expect(mockedCreatePaymentRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        supabase: supabase.client,
        amount: 500,
        createdBy: "profile-1",
        reservationId: RESERVATION_ID,
      })
    );
    expect(body.request).toEqual(expect.objectContaining({
      id: "payment-request-1",
      reservationId: RESERVATION_ID,
    }));
  });
});

function buildRequest(body: unknown): NextRequest {
  return new Request("http://localhost/api/admin/payment-requests", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

function createSupabaseMock(args: { reservation: ReservationPaymentMethodRow | null }) {
  const maybeSingle = vi.fn(async () => ({
    data: args.reservation,
    error: null,
  }));
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn((table: string): unknown => {
    if (table === "reservations") {
      return { select };
    }
    throw new Error(`Unexpected table ${table}`);
  });

  return {
    client: { from },
  };
}

function buildPaymentRequest(): PaymentRequest {
  return {
    id: "payment-request-1",
    identifier: "ABCDE",
    reservationId: RESERVATION_ID,
    folioItemId: null,
    amount: 500,
    paidAmount: 0,
    status: "pending",
    upiId: "airvik@testupi",
    upiMerchantName: "Airvik",
    upiUri: "upi://pay?pa=airvik@testupi&am=500",
    requestedAt: "2026-05-24T08:30:00.000Z",
    expiresAt: "2026-05-24T11:30:00.000Z",
    paidAt: null,
    paymentReference: null,
    matchedTransaction: null,
    notes: null,
    createdBy: "profile-1",
    createdAt: "2026-05-24T08:30:00.000Z",
    updatedAt: "2026-05-24T08:30:00.000Z",
  };
}

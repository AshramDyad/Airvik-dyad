import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PaymentRequest } from "@/data/types";
import { createServerSupabaseClient } from "@/integrations/supabase/server";
import { markPaymentRequestPaidManually } from "@/lib/payments/payment-requests-server";
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

vi.mock("@/lib/payments/payment-requests-server", () => ({
  markPaymentRequestPaidManually: vi.fn(),
}));

const mockedCreateServerSupabaseClient = vi.mocked(createServerSupabaseClient);
const mockedRequirePermission = vi.mocked(requirePermission);
const mockedMarkPaid = vi.mocked(markPaymentRequestPaidManually);

const REQUEST_ID = "00000000-0000-0000-0000-000000000301";

describe("payment request confirm route", () => {
  beforeEach(() => {
    mockedCreateServerSupabaseClient.mockReset();
    mockedMarkPaid.mockReset();
    mockedRequirePermission.mockResolvedValue({
      userId: "admin-1",
      roleName: "Administration",
      permissions: ["update:payment"],
    });
  });

  it("requires update payment permission and marks the single request paid", async () => {
    const supabase = { from: vi.fn() };
    mockedCreateServerSupabaseClient.mockReturnValue(
      supabase as unknown as ReturnType<typeof createServerSupabaseClient>
    );
    mockedMarkPaid.mockResolvedValue(buildPaidRequest());

    const response = await POST(buildRequest(REQUEST_ID), {
      params: Promise.resolve({ id: REQUEST_ID }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    const permissionCall = mockedRequirePermission.mock.calls[0];
    expect(permissionCall?.[0]).toBeInstanceOf(Request);
    expect(permissionCall?.[1]).toBe("update:payment");
    expect(mockedMarkPaid).toHaveBeenCalledWith({
      supabase,
      paymentRequestId: REQUEST_ID,
    });
    expect(body.request).toEqual(
      expect.objectContaining({
        id: REQUEST_ID,
        status: "paid",
        paidAmount: 1500,
      })
    );
  });

  it("rejects a non-UUID id before touching the database", async () => {
    mockedCreateServerSupabaseClient.mockReturnValue(
      { from: vi.fn() } as unknown as ReturnType<typeof createServerSupabaseClient>
    );

    const response = await POST(buildRequest("not-a-uuid"), {
      params: Promise.resolve({ id: "not-a-uuid" }),
    });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({
      message: "Payment request id must be a valid UUID.",
    });
    expect(mockedMarkPaid).not.toHaveBeenCalled();
  });
});

function buildRequest(id: string): Request {
  return new Request(`http://localhost/api/admin/payment-requests/${id}/confirm`, {
    method: "POST",
  });
}

function buildPaidRequest(): PaymentRequest {
  return {
    id: REQUEST_ID,
    identifier: "ABCDE",
    statementCode: "KJRM",
    reservationId: "00000000-0000-0000-0000-000000000201",
    folioItemId: "folio-1",
    amount: 1500,
    paidAmount: 1500,
    status: "paid",
    upiId: "merchant@upi",
    upiMerchantName: "Ashram",
    upiUri: "upi://pay?pa=merchant@upi&am=1500",
    requestedAt: "2026-05-24T08:00:00.000Z",
    expiresAt: "2026-05-24T11:00:00.000Z",
    paidAt: "2026-05-24T08:10:00.000Z",
    paymentReference: "manual-admin-confirm",
    matchedTransaction: null,
    notes: null,
    createdBy: "user-1",
    createdAt: "2026-05-24T08:00:00.000Z",
    updatedAt: "2026-05-24T08:10:00.000Z",
  };
}

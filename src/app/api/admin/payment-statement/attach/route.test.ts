import { beforeEach, describe, expect, it, vi } from "vitest";

import { createServerSupabaseClient } from "@/integrations/supabase/server";
import { attachStatementPaymentToBooking } from "@/lib/payments/statement-links-server";
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

vi.mock("@/lib/payments/statement-links-server", () => ({
  attachStatementPaymentToBooking: vi.fn(),
}));

const mockedCreateServerSupabaseClient = vi.mocked(createServerSupabaseClient);
const mockedRequirePermission = vi.mocked(requirePermission);
const mockedAttach = vi.mocked(attachStatementPaymentToBooking);

describe("payment statement attach route", () => {
  beforeEach(() => {
    mockedCreateServerSupabaseClient.mockReset();
    mockedAttach.mockReset();
    mockedRequirePermission.mockResolvedValue({
      userId: "admin-1",
      roleName: "Administration",
      permissions: ["update:payment"],
    });
  });

  it("requires update payment permission and attaches the transaction", async () => {
    const supabase = { from: vi.fn() };
    mockedCreateServerSupabaseClient.mockReturnValue(
      supabase as unknown as ReturnType<typeof createServerSupabaseClient>
    );
    mockedAttach.mockResolvedValue({ reservationId: "res-1" });

    const response = await POST(
      buildRequest({ bookingId: "A100001", amount: 2000, reference: "UTR-1" })
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    const permissionCall = mockedRequirePermission.mock.calls[0];
    expect(permissionCall?.[1]).toBe("update:payment");
    expect(mockedAttach).toHaveBeenCalledWith({
      supabase,
      bookingId: "A100001",
      amount: 2000,
      reference: "UTR-1",
      actorUserId: "admin-1",
    });
    expect(body).toEqual({ reservationId: "res-1" });
  });

  it("rejects an empty booking id before touching the database", async () => {
    mockedCreateServerSupabaseClient.mockReturnValue(
      { from: vi.fn() } as unknown as ReturnType<typeof createServerSupabaseClient>
    );

    const response = await POST(
      buildRequest({ bookingId: "  ", amount: 2000, reference: "UTR-1" })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.message).toBe("Invalid attach request.");
    expect(mockedAttach).not.toHaveBeenCalled();
  });

  it("surfaces the duplicate error from the database layer", async () => {
    mockedCreateServerSupabaseClient.mockReturnValue(
      { from: vi.fn() } as unknown as ReturnType<typeof createServerSupabaseClient>
    );
    mockedAttach.mockRejectedValue(
      new Error("This transaction is already attached to a booking.")
    );

    const response = await POST(
      buildRequest({ bookingId: "A100001", amount: 2000, reference: "UTR-1" })
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.message).toBe(
      "This transaction is already attached to a booking."
    );
  });
});

function buildRequest(payload: unknown): Request {
  return new Request("http://localhost/api/admin/payment-statement/attach", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

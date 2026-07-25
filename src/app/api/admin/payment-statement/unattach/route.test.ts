import { beforeEach, describe, expect, it, vi } from "vitest";

import { createServerSupabaseClient } from "@/integrations/supabase/server";
import { logAdminActivityFromProfile } from "@/lib/activity/server";
import { unattachStatementPayment } from "@/lib/payments/statement-links-server";
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
  unattachStatementPayment: vi.fn(),
}));

vi.mock("@/lib/activity/server", () => ({
  logAdminActivityFromProfile: vi.fn(),
}));

const mockedCreateServerSupabaseClient = vi.mocked(createServerSupabaseClient);
const mockedRequirePermission = vi.mocked(requirePermission);
const mockedUnattach = vi.mocked(unattachStatementPayment);
const mockedLogActivity = vi.mocked(logAdminActivityFromProfile);

const FOLIO_ITEM_ID = "3f6b0f9c-3a2b-4c1d-9f7e-2b8a5d4c1e00";

describe("payment statement unattach route", () => {
  beforeEach(() => {
    mockedCreateServerSupabaseClient.mockReset();
    mockedUnattach.mockReset();
    mockedLogActivity.mockReset();
    mockedLogActivity.mockResolvedValue(undefined);
    mockedRequirePermission.mockResolvedValue({
      userId: "admin-1",
      roleName: "Administration",
      permissions: ["update:payment"],
    });
    mockedUnattach.mockResolvedValue({
      reservationId: "res-1",
      bookingId: "A100001",
      amount: -2500,
      statusReverted: true,
    });
  });

  it("deletes the payment for an Administration user", async () => {
    const supabase = { from: vi.fn() };
    mockedCreateServerSupabaseClient.mockReturnValue(
      supabase as unknown as ReturnType<typeof createServerSupabaseClient>
    );

    const response = await POST(buildRequest({ folioItemId: FOLIO_ITEM_ID }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockedRequirePermission.mock.calls[0]?.[1]).toBe("update:payment");
    expect(mockedUnattach).toHaveBeenCalledWith({
      supabase,
      folioItemId: FOLIO_ITEM_ID,
    });
    expect(body).toEqual({ ok: true, statusReverted: true });
  });

  it("refuses a non-Administration role that still holds update:payment", async () => {
    mockedRequirePermission.mockResolvedValue({
      userId: "desk-1",
      roleName: "Receptionist",
      permissions: ["update:payment"],
    });
    mockedCreateServerSupabaseClient.mockReturnValue(
      { from: vi.fn() } as unknown as ReturnType<typeof createServerSupabaseClient>
    );

    const response = await POST(buildRequest({ folioItemId: FOLIO_ITEM_ID }));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.message).toBe("Only Administration can unattach a payment.");
    expect(mockedUnattach).not.toHaveBeenCalled();
  });

  it("rejects a malformed folio item id before touching the database", async () => {
    mockedCreateServerSupabaseClient.mockReturnValue(
      { from: vi.fn() } as unknown as ReturnType<typeof createServerSupabaseClient>
    );

    const response = await POST(buildRequest({ folioItemId: "not-a-uuid" }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.message).toBe("Invalid unattach request.");
    expect(mockedUnattach).not.toHaveBeenCalled();
  });

  it("surfaces a rejection from the database layer", async () => {
    mockedCreateServerSupabaseClient.mockReturnValue(
      { from: vi.fn() } as unknown as ReturnType<typeof createServerSupabaseClient>
    );
    mockedUnattach.mockRejectedValue(
      new Error("Only a manually attached UPI Gateway payment can be unattached.")
    );

    const response = await POST(buildRequest({ folioItemId: FOLIO_ITEM_ID }));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.message).toBe(
      "Only a manually attached UPI Gateway payment can be unattached."
    );
  });

  it("still reports success when the audit log write fails", async () => {
    mockedCreateServerSupabaseClient.mockReturnValue(
      { from: vi.fn() } as unknown as ReturnType<typeof createServerSupabaseClient>
    );
    mockedLogActivity.mockRejectedValue(new Error("activity log unavailable"));

    const response = await POST(buildRequest({ folioItemId: FOLIO_ITEM_ID }));

    expect(response.status).toBe(200);
    expect(mockedUnattach).toHaveBeenCalled();
  });
});

function buildRequest(payload: unknown): Request {
  return new Request("http://localhost/api/admin/payment-statement/unattach", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

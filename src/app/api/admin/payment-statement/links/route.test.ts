import { beforeEach, describe, expect, it, vi } from "vitest";

import { createServerSupabaseClient } from "@/integrations/supabase/server";
import { getStatementBookingLinks } from "@/lib/payments/statement-links-server";
import { requireFeature } from "@/lib/server/auth";
import { GET } from "./route";

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
  };
});

vi.mock("@/lib/payments/statement-links-server", () => ({
  getStatementBookingLinks: vi.fn(),
}));

const mockedCreateServerSupabaseClient = vi.mocked(createServerSupabaseClient);
const mockedRequireFeature = vi.mocked(requireFeature);
const mockedGetLinks = vi.mocked(getStatementBookingLinks);

describe("payment statement links route", () => {
  beforeEach(() => {
    mockedCreateServerSupabaseClient.mockReset();
    mockedGetLinks.mockReset();
    mockedRequireFeature.mockResolvedValue({
      userId: "admin-1",
      roleName: "Administration",
      permissions: ["read:payment"],
    });
  });

  it("requires the payments feature and returns the booking links", async () => {
    const supabase = { from: vi.fn() };
    mockedCreateServerSupabaseClient.mockReturnValue(
      supabase as unknown as ReturnType<typeof createServerSupabaseClient>
    );
    mockedGetLinks.mockResolvedValue([
      { reference: "UTR-1", reservationId: "res-1", bookingId: "A100001" },
    ]);

    const response = await GET(buildRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    const featureCall = mockedRequireFeature.mock.calls[0];
    expect(featureCall?.[0]).toBeInstanceOf(Request);
    expect(featureCall?.[1]).toBe("payments");
    expect(mockedGetLinks).toHaveBeenCalledWith({ supabase });
    expect(body.links).toEqual([
      { reference: "UTR-1", reservationId: "res-1", bookingId: "A100001" },
    ]);
  });
});

function buildRequest(): Request {
  return new Request("http://localhost/api/admin/payment-statement/links");
}

import { beforeEach, describe, expect, it, vi } from "vitest";

import { createServerSupabaseClient } from "@/integrations/supabase/server";
import { getDailyPaymentAccounting } from "@/lib/payments/accounting-server";
import { requireFeature } from "@/lib/server/auth";
import { GET } from "./route";

vi.mock("@/integrations/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(),
}));

vi.mock("@/lib/payments/accounting-server", () => ({
  getDailyPaymentAccounting: vi.fn(),
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

const mockedCreateServerSupabaseClient = vi.mocked(createServerSupabaseClient);
const mockedGetDailyPaymentAccounting = vi.mocked(getDailyPaymentAccounting);
const mockedRequireFeature = vi.mocked(requireFeature);

describe("accounts route", () => {
  beforeEach(() => {
    mockedCreateServerSupabaseClient.mockReset();
    mockedGetDailyPaymentAccounting.mockReset();
    mockedRequireFeature.mockResolvedValue({
      userId: "admin-1",
      roleName: "Administration",
      permissions: ["read:payment"],
    });
  });

  it("requires payment access and returns uncached daily accounting", async () => {
    const supabaseClient = { from: vi.fn() };
    mockedCreateServerSupabaseClient.mockReturnValue(
      supabaseClient as unknown as ReturnType<typeof createServerSupabaseClient>
    );
    mockedGetDailyPaymentAccounting.mockResolvedValue({
      date: "2026-05-24",
      from: "2026-05-23T18:30:00.000Z",
      to: "2026-05-24T18:30:00.000Z",
      transactions: [],
      summary: {
        onlineTotal: 0,
        onlineCount: 0,
        cashTotal: 0,
        cashCount: 0,
        total: 0,
        cashByReceiver: [],
      },
    });

    const response = await GET(
      new Request(
        "http://localhost/api/admin/accounts?date=2026-05-24&timeZone=Asia/Kolkata"
      )
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    const featureCall = mockedRequireFeature.mock.calls[0];
    expect(featureCall?.[0]).toBeInstanceOf(Request);
    expect(featureCall?.[1]).toBe("payments");
    expect(mockedGetDailyPaymentAccounting).toHaveBeenCalledWith({
      supabase: supabaseClient,
      date: "2026-05-24",
      timeZone: "Asia/Kolkata",
    });
    expect(body.summary.total).toBe(0);
  });
});

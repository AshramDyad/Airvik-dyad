import { beforeEach, describe, expect, it, vi } from "vitest";

const getAdminRatesDataMock = vi.hoisted(() => vi.fn());
const requireAdminProfileMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/server/admin-rates", () => ({
  getAdminRatesData: getAdminRatesDataMock,
}));

vi.mock("@/lib/server/auth", () => ({
  HttpError: class HttpError extends Error {
    status: number;

    constructor(message: string, status = 500) {
      super(message);
      this.status = status;
    }
  },
  requireAdminProfile: requireAdminProfileMock,
}));

import { GET } from "./route";

describe("admin rates API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns rates data with no-store headers", async () => {
    getAdminRatesDataMock.mockResolvedValue({
      ratePlans: [
        {
          id: "rate-1",
          name: "Standard",
          price: 1200,
          rules: { minStay: 1, cancellationPolicy: "Flexible" },
        },
      ],
      seasonalPrices: [
        {
          id: "season-1",
          roomTypeId: "type-1",
          name: "Peak",
          price: 1500,
          startDate: "2026-10-01",
          endDate: "2026-10-31",
        },
      ],
      roomTypes: [{ id: "type-1", name: "Ganga View" }],
    });

    const response = await GET(new Request("https://airvik.test/api/admin/rates"));

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    await expect(response.json()).resolves.toEqual({
      data: {
        ratePlans: [
          {
            id: "rate-1",
            name: "Standard",
            price: 1200,
            rules: { minStay: 1, cancellationPolicy: "Flexible" },
          },
        ],
        seasonalPrices: [
          {
            id: "season-1",
            roomTypeId: "type-1",
            name: "Peak",
            price: 1500,
            startDate: "2026-10-01",
            endDate: "2026-10-31",
          },
        ],
        roomTypes: [{ id: "type-1", name: "Ganga View" }],
      },
    });
    expect(requireAdminProfileMock).toHaveBeenCalledTimes(1);
    expect(getAdminRatesDataMock).toHaveBeenCalledTimes(1);
  });
});

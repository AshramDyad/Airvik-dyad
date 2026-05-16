import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  requireFeature: vi.fn(),
  HttpError: class HttpError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  },
}));
const getReportReservationsMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/server/auth", () => authMocks);
vi.mock("@/lib/server/report-reservations", () => ({
  getReportReservations: getReportReservationsMock,
}));

import { GET } from "./route";

describe("report reservations API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requires report access and returns lean reservation rows without shared caching", async () => {
    getReportReservationsMock.mockResolvedValue({
      data: [
        {
          id: "reservation-1",
          checkInDate: "2026-05-10",
          checkOutDate: "2026-05-12",
          status: "Checked-out",
          totalAmount: 5000,
        },
      ],
      roomsForSaleCount: 3,
    });

    const response = await GET(
      new Request(
        "http://localhost/api/admin/reports/reservations?from=2026-05-01&to=2026-05-31",
      ) as never,
    );

    expect(response.status).toBe(200);
    expect(authMocks.requireFeature).toHaveBeenCalledWith(
      expect.any(Request),
      "reports",
    );
    expect(getReportReservationsMock).toHaveBeenCalledWith({
      from: "2026-05-01",
      to: "2026-05-31",
    });
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    await expect(response.json()).resolves.toEqual({
      data: [
        {
          id: "reservation-1",
          checkInDate: "2026-05-10",
          checkOutDate: "2026-05-12",
          status: "Checked-out",
          totalAmount: 5000,
        },
      ],
      roomsForSaleCount: 3,
    });
  });

  it("rejects invalid report date parameters", async () => {
    const response = await GET(
      new Request(
        "http://localhost/api/admin/reports/reservations?from=2026-05&to=2026-05-31",
      ) as never,
    );

    expect(response.status).toBe(400);
    expect(getReportReservationsMock).not.toHaveBeenCalled();
  });
});

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
const getDashboardSummaryForDateMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/server/auth", () => authMocks);
vi.mock("@/lib/server/dashboard-summary", () => ({
  getDashboardSummaryForDate: getDashboardSummaryForDateMock,
}));

import { GET } from "./route";

describe("dashboard summary API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requires dashboard access and returns the compact summary without shared caching", async () => {
    getDashboardSummaryForDateMock.mockResolvedValue({
      occupancyPercentage: 50,
      occupiedRoomsCount: 2,
      availableRooms: 2,
      roomsForSaleCount: 4,
      arrivalsRows: [
        {
          id: "arrival-1",
          guestName: "Asha Guest",
          guestEmail: "asha@example.com",
          roomNumber: "101",
          status: "Confirmed",
        },
      ],
      departuresRows: [],
    });

    const response = await GET(
      new Request(
        "http://localhost/api/admin/dashboard/summary?date=2026-05-13",
      ) as never,
    );

    expect(response.status).toBe(200);
    expect(authMocks.requireFeature).toHaveBeenCalledWith(
      expect.any(Request),
      "dashboard",
    );
    expect(getDashboardSummaryForDateMock).toHaveBeenCalledWith("2026-05-13");
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    await expect(response.json()).resolves.toEqual({
      data: {
        occupancyPercentage: 50,
        occupiedRoomsCount: 2,
        availableRooms: 2,
        roomsForSaleCount: 4,
        arrivalsRows: [
          {
            id: "arrival-1",
            guestName: "Asha Guest",
            guestEmail: "asha@example.com",
            roomNumber: "101",
            status: "Confirmed",
          },
        ],
        departuresRows: [],
      },
    });
  });

  it("rejects invalid date params before querying dashboard data", async () => {
    const response = await GET(
      new Request(
        "http://localhost/api/admin/dashboard/summary?date=13-05-2026",
      ) as never,
    );

    expect(response.status).toBe(400);
    expect(getDashboardSummaryForDateMock).not.toHaveBeenCalled();
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });
});

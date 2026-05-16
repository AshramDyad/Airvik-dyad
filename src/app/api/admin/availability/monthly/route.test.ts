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
const getCachedMonthlyAvailabilityMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/server/auth", () => authMocks);
vi.mock("@/lib/server/monthly-availability", () => ({
  getCachedMonthlyAvailability: getCachedMonthlyAvailabilityMock,
}));

import { GET } from "./route";

describe("admin monthly availability API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requires calendar access and returns cached monthly availability without shared response caching", async () => {
    getCachedMonthlyAvailabilityMock.mockResolvedValue([
      {
        roomType: {
          id: "room-type-1",
          name: "Deluxe",
          description: "",
          rooms: [],
          units: 0,
          sharedInventory: false,
        },
        availability: [],
      },
    ]);

    const response = await GET(
      new Request(
        "http://localhost/api/admin/availability/monthly?monthStart=2026-05-01&roomTypeIds=rt-2,rt-1",
      ) as never,
    );

    expect(response.status).toBe(200);
    expect(authMocks.requireFeature).toHaveBeenCalledWith(
      expect.any(Request),
      "calendar",
    );
    expect(getCachedMonthlyAvailabilityMock).toHaveBeenCalledWith(
      "2026-05-01",
      ["rt-1", "rt-2"],
    );
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    await expect(response.json()).resolves.toEqual({
      data: [
        {
          roomType: {
            id: "room-type-1",
            name: "Deluxe",
            description: "",
            rooms: [],
            units: 0,
            sharedInventory: false,
          },
          availability: [],
        },
      ],
    });
  });

  it("rejects invalid month starts", async () => {
    const response = await GET(
      new Request(
        "http://localhost/api/admin/availability/monthly?monthStart=2026-05-02",
      ) as never,
    );

    expect(response.status).toBe(400);
    expect(getCachedMonthlyAvailabilityMock).not.toHaveBeenCalled();
  });
});

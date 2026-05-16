import { beforeEach, describe, expect, it, vi } from "vitest";

const getAdminHousekeepingDataMock = vi.hoisted(() => vi.fn());
const requireFeatureMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/server/admin-housekeeping", () => ({
  getAdminHousekeepingData: getAdminHousekeepingDataMock,
}));

vi.mock("@/lib/server/auth", () => ({
  HttpError: class HttpError extends Error {
    status: number;

    constructor(message: string, status = 500) {
      super(message);
      this.status = status;
    }
  },
  requireFeature: requireFeatureMock,
}));

import { GET } from "./route";

describe("admin housekeeping API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns housekeeping data for the requested date with no-store headers", async () => {
    getAdminHousekeepingDataMock.mockResolvedValue({
      rooms: [
        {
          id: "room-1",
          roomNumber: "101",
          roomTypeId: "type-1",
          status: "Dirty",
        },
      ],
      roomTypes: [{ id: "type-1", name: "Ganga View" }],
      assignments: [
        {
          roomId: "room-1",
          assignedTo: "user-1",
          date: "2026-05-13",
          status: "Pending",
        },
      ],
      housekeepers: [
        { id: "user-1", name: "Anita", email: "", roleId: "role-housekeeper" },
      ],
    });

    const response = await GET(
      new Request("https://airvik.test/api/admin/housekeeping?date=2026-05-13"),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    await expect(response.json()).resolves.toEqual({
      data: {
        rooms: [
          {
            id: "room-1",
            roomNumber: "101",
            roomTypeId: "type-1",
            status: "Dirty",
          },
        ],
        roomTypes: [{ id: "type-1", name: "Ganga View" }],
        assignments: [
          {
            roomId: "room-1",
            assignedTo: "user-1",
            date: "2026-05-13",
            status: "Pending",
          },
        ],
        housekeepers: [
          {
            id: "user-1",
            name: "Anita",
            email: "",
            roleId: "role-housekeeper",
          },
        ],
      },
    });
    expect(requireFeatureMock).toHaveBeenCalledWith(expect.any(Request), "housekeeping");
    expect(getAdminHousekeepingDataMock).toHaveBeenCalledWith("2026-05-13");
  });
});

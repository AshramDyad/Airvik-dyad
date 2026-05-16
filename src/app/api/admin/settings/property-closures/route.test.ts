import { beforeEach, describe, expect, it, vi } from "vitest";

const getAdminSettingsPropertyClosuresDataMock = vi.hoisted(() => vi.fn());
const requireAdminProfileMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/server/admin-settings-property-closures", () => ({
  getAdminSettingsPropertyClosuresData:
    getAdminSettingsPropertyClosuresDataMock,
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

describe("admin settings property closures API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns settings closure data with no-store headers", async () => {
    getAdminSettingsPropertyClosuresDataMock.mockResolvedValue({
      propertyClosures: [
        {
          id: "closure-1",
          propertyId: "property-1",
          startDate: "2026-06-01",
          endDate: "2026-06-03",
          reason: "Maintenance",
        },
      ],
      roomTypes: [{ id: "room-type-1", name: "Ganga View" }],
    });

    const response = await GET(
      new Request(
        "https://airvik.test/api/admin/settings/property-closures",
      ),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    await expect(response.json()).resolves.toEqual({
      data: {
        propertyClosures: [
          {
            id: "closure-1",
            propertyId: "property-1",
            startDate: "2026-06-01",
            endDate: "2026-06-03",
            reason: "Maintenance",
          },
        ],
        roomTypes: [{ id: "room-type-1", name: "Ganga View" }],
      },
    });
    expect(requireAdminProfileMock).toHaveBeenCalledTimes(1);
    expect(getAdminSettingsPropertyClosuresDataMock).toHaveBeenCalledTimes(1);
  });
});

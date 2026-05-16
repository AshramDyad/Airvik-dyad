import { beforeEach, describe, expect, it, vi } from "vitest";

const getPublicBookingSearchDataMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/server/booking-search", () => ({
  getCachedPublicBookingSearchData: getPublicBookingSearchDataMock,
}));

import { GET } from "./route";

describe("public booking search data API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns compact booking search metadata with public cache headers", async () => {
    getPublicBookingSearchDataMock.mockResolvedValue({
      roomTypes: [{ id: "room-type-1", name: "Ganga View" }],
      amenities: [{ id: "wifi", name: "Wifi", icon: "Wifi" }],
      ratePlan: { id: "standard", name: "Standard Rate" },
      propertyClosures: [],
    });

    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe(
      "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400",
    );
    expect(getPublicBookingSearchDataMock).toHaveBeenCalledWith(
      expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    );
    await expect(response.json()).resolves.toEqual({
      data: {
        roomTypes: [{ id: "room-type-1", name: "Ganga View" }],
        amenities: [{ id: "wifi", name: "Wifi", icon: "Wifi" }],
        ratePlan: { id: "standard", name: "Standard Rate" },
        propertyClosures: [],
      },
    });
  });
});

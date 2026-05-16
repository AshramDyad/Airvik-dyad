import { beforeEach, describe, expect, it, vi } from "vitest";

const getPublicBookingReviewDataMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/server/booking-review", () => ({
  getCachedPublicBookingReviewData: getPublicBookingReviewDataMock,
}));

import { GET } from "./route";

describe("public booking review data API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns selected-room review data with public cache headers", async () => {
    getPublicBookingReviewDataMock.mockResolvedValue({
      roomTypes: [{ id: "room-type-1", name: "Ganga View" }],
      ratePlan: null,
      seasonalPrices: [],
      propertyClosures: [],
    });

    const response = await GET(
      new Request(
        "http://localhost/api/bookings/review-data?roomTypeId=room-type-1&roomTypeId=room-type-1&from=2026-10-04&to=2026-10-06",
      ),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe(
      "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400",
    );
    expect(getPublicBookingReviewDataMock).toHaveBeenCalledWith({
      roomTypeIds: ["room-type-1", "room-type-1"],
      checkIn: "2026-10-04",
      checkOut: "2026-10-06",
    });
    await expect(response.json()).resolves.toEqual({
      data: {
        roomTypes: [{ id: "room-type-1", name: "Ganga View" }],
        ratePlan: null,
        seasonalPrices: [],
        propertyClosures: [],
      },
    });
  });

  it("rejects missing review query params before querying Supabase", async () => {
    const response = await GET(
      new Request("http://localhost/api/bookings/review-data"),
    );

    expect(response.status).toBe(400);
    expect(getPublicBookingReviewDataMock).not.toHaveBeenCalled();
  });
});

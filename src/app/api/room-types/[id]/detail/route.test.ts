import { beforeEach, describe, expect, it, vi } from "vitest";

const getPublicRoomTypeDetailMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/server/room-type-detail", () => ({
  getCachedPublicRoomTypeDetail: getPublicRoomTypeDetailMock,
}));

import { GET } from "./route";

describe("public room type detail API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns cached room-type-scoped detail data", async () => {
    getPublicRoomTypeDetailMock.mockResolvedValue({
      roomType: { id: "room-type-1", name: "Ganga View" },
      relatedRoomTypes: [],
      amenities: [],
      standardRatePlan: null,
      seasonalPrices: [],
      propertyClosures: [],
    });

    const response = await GET(
      new Request("http://localhost/api/room-types/room-type-1/detail"),
      { params: Promise.resolve({ id: "room-type-1" }) },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe(
      "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400",
    );
    expect(getPublicRoomTypeDetailMock).toHaveBeenCalledWith("room-type-1");
    await expect(response.json()).resolves.toEqual({
      data: {
        roomType: { id: "room-type-1", name: "Ganga View" },
        relatedRoomTypes: [],
        amenities: [],
        standardRatePlan: null,
        seasonalPrices: [],
        propertyClosures: [],
      },
    });
  });

  it("rejects missing room type ids before querying Supabase", async () => {
    const response = await GET(
      new Request("http://localhost/api/room-types/%20/detail"),
      { params: Promise.resolve({ id: " " }) },
    );

    expect(response.status).toBe(400);
    expect(getPublicRoomTypeDetailMock).not.toHaveBeenCalled();
  });
});

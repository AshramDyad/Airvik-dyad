import { beforeEach, describe, expect, it, vi } from "vitest";

const searchPublicAvailabilityMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/server/availability", () => ({
  searchPublicAvailability: searchPublicAvailabilityMock,
}));

import { POST } from "./route";

describe("public availability search API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns availability with no-store headers", async () => {
    const availability = {
      availableRoomTypeIds: ["type-1"],
      roomTypeAvailability: [{ roomTypeId: "type-1", availableRooms: 2 }],
      hasNoInventory: false,
      isDatesBlocked: false,
    };
    searchPublicAvailabilityMock.mockResolvedValue(availability);

    const response = await POST(
      new Request("http://localhost/api/availability/search", {
        method: "POST",
        body: JSON.stringify({
          checkIn: "2026-06-10",
          checkOut: "2026-06-12",
          roomOccupancies: [{ adults: 2, children: 0 }],
          categoryIds: ["category-1"],
          roomTypeIds: ["type-1"],
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({ data: availability });
    expect(searchPublicAvailabilityMock).toHaveBeenCalledWith({
      checkIn: "2026-06-10",
      checkOut: "2026-06-12",
      roomOccupancies: [{ adults: 2, children: 0 }],
      categoryIds: ["category-1"],
      roomTypeIds: ["type-1"],
    });
  });

  it("rejects invalid date ranges before querying Supabase", async () => {
    const response = await POST(
      new Request("http://localhost/api/availability/search", {
        method: "POST",
        body: JSON.stringify({
          checkIn: "2026-06-12",
          checkOut: "2026-06-10",
          roomOccupancies: [{ adults: 2, children: 0 }],
        }),
      }),
    );

    expect(response.status).toBe(400);
    expect(searchPublicAvailabilityMock).not.toHaveBeenCalled();
  });
});

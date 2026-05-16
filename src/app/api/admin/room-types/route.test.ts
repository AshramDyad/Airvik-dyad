import { beforeEach, describe, expect, it, vi } from "vitest";

const getAdminRoomTypesDataMock = vi.hoisted(() => vi.fn());
const requireAdminProfileMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/server/admin-room-types", () => ({
  getAdminRoomTypesData: getAdminRoomTypesDataMock,
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

describe("admin room types API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns room types and compact amenity options with no-store headers", async () => {
    getAdminRoomTypesDataMock.mockResolvedValue({
      roomTypes: [
        {
          id: "type-1",
          name: "Ganga View",
          description: "River-facing room",
          maxOccupancy: 2,
          bedTypes: ["King"],
          price: 2400,
          amenities: ["amenity-1"],
          photos: ["room-type.jpg"],
          mainPhotoUrl: "main.jpg",
          isVisible: true,
        },
      ],
      amenities: [{ id: "amenity-1", name: "Wifi" }],
    });

    const response = await GET(
      new Request("https://airvik.test/api/admin/room-types"),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    await expect(response.json()).resolves.toEqual({
      data: {
        roomTypes: [
          {
            id: "type-1",
            name: "Ganga View",
            description: "River-facing room",
            maxOccupancy: 2,
            bedTypes: ["King"],
            price: 2400,
            amenities: ["amenity-1"],
            photos: ["room-type.jpg"],
            mainPhotoUrl: "main.jpg",
            isVisible: true,
          },
        ],
        amenities: [{ id: "amenity-1", name: "Wifi" }],
      },
    });
    expect(requireAdminProfileMock).toHaveBeenCalledTimes(1);
    expect(getAdminRoomTypesDataMock).toHaveBeenCalledTimes(1);
  });
});

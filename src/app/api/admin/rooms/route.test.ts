import { beforeEach, describe, expect, it, vi } from "vitest";

const getAdminRoomsDataMock = vi.hoisted(() => vi.fn());
const requireAdminProfileMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/server/admin-rooms", () => ({
  getAdminRoomsData: getAdminRoomsDataMock,
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

describe("admin rooms API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns rooms and compact room type summaries with no-store headers", async () => {
    getAdminRoomsDataMock.mockResolvedValue({
      rooms: [
        {
          id: "room-1",
          roomNumber: "101",
          roomTypeId: "type-1",
          status: "Clean",
          photos: ["room.jpg"],
        },
      ],
      roomTypes: [
        {
          id: "type-1",
          name: "Ganga View",
          mainPhotoUrl: "type-main.jpg",
        },
      ],
    });

    const response = await GET(new Request("https://airvik.test/api/admin/rooms"));

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    await expect(response.json()).resolves.toEqual({
      data: {
        rooms: [
          {
            id: "room-1",
            roomNumber: "101",
            roomTypeId: "type-1",
            status: "Clean",
            photos: ["room.jpg"],
          },
        ],
        roomTypes: [
          {
            id: "type-1",
            name: "Ganga View",
            mainPhotoUrl: "type-main.jpg",
          },
        ],
      },
    });
    expect(requireAdminProfileMock).toHaveBeenCalledTimes(1);
    expect(getAdminRoomsDataMock).toHaveBeenCalledTimes(1);
  });
});

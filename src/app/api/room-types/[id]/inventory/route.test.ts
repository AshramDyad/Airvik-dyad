import { beforeEach, describe, expect, it, vi } from "vitest";

const getPublicRoomTypeInventoryMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/server/room-type-inventory", () => ({
  getPublicRoomTypeInventory: getPublicRoomTypeInventoryMock,
}));

import { GET } from "./route";

describe("public room type inventory API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns room-type-scoped inventory with no-store headers", async () => {
    getPublicRoomTypeInventoryMock.mockResolvedValue({
      roomTypeId: "room-type-1",
      totalBookableRooms: 3,
    });

    const response = await GET(
      new Request("http://localhost/api/room-types/room-type-1/inventory"),
      { params: Promise.resolve({ id: "room-type-1" }) },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(getPublicRoomTypeInventoryMock).toHaveBeenCalledWith("room-type-1");
    await expect(response.json()).resolves.toEqual({
      data: {
        roomTypeId: "room-type-1",
        totalBookableRooms: 3,
      },
    });
  });

  it("rejects missing room type ids before querying Supabase", async () => {
    const response = await GET(
      new Request("http://localhost/api/room-types/%20/inventory"),
      { params: Promise.resolve({ id: " " }) },
    );

    expect(response.status).toBe(400);
    expect(getPublicRoomTypeInventoryMock).not.toHaveBeenCalled();
  });
});

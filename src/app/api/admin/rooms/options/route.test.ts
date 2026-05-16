import { beforeEach, describe, expect, it, vi } from "vitest";

const getAdminRoomOptionsMock = vi.hoisted(() => vi.fn());
const requireAdminProfileMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/server/admin-room-options", () => ({
  getAdminRoomOptions: getAdminRoomOptionsMock,
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

describe("admin room options API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns room mapping options with no-store headers", async () => {
    getAdminRoomOptionsMock.mockResolvedValue([
      { id: "room-1", roomNumber: "101" },
    ]);

    const response = await GET(new Request("https://airvik.test/api/admin/rooms/options"));

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    await expect(response.json()).resolves.toEqual({
      data: [{ id: "room-1", roomNumber: "101" }],
    });
    expect(requireAdminProfileMock).toHaveBeenCalledTimes(1);
    expect(getAdminRoomOptionsMock).toHaveBeenCalledTimes(1);
  });
});

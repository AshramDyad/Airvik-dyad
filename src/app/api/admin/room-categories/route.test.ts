import { beforeEach, describe, expect, it, vi } from "vitest";

const getAdminRoomCategoriesMock = vi.hoisted(() => vi.fn());
const requireAdminProfileMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/server/admin-room-categories", () => ({
  getAdminRoomCategories: getAdminRoomCategoriesMock,
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

describe("admin room categories API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns room categories with no-store headers", async () => {
    getAdminRoomCategoriesMock.mockResolvedValue([
      { id: "category-1", name: "Standard", description: "" },
    ]);

    const response = await GET(
      new Request("https://airvik.test/api/admin/room-categories"),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    await expect(response.json()).resolves.toEqual({
      data: [{ id: "category-1", name: "Standard", description: "" }],
    });
    expect(requireAdminProfileMock).toHaveBeenCalledTimes(1);
    expect(getAdminRoomCategoriesMock).toHaveBeenCalledTimes(1);
  });
});

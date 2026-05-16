import { beforeEach, describe, expect, it, vi } from "vitest";

const roomNumberLinkMocks = vi.hoisted(() => ({
  fetchRoomNumberLinks: vi.fn(),
  upsertRoomNumberLink: vi.fn(),
}));
const authMocks = vi.hoisted(() => ({
  requireAdminProfile: vi.fn(),
  HttpError: class HttpError extends Error {
    status: number;

    constructor(message: string, status = 500) {
      super(message);
      this.status = status;
    }
  },
}));
const createServerSupabaseClientMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/importers/vikbooking/room-number-links", () => roomNumberLinkMocks);
vi.mock("@/lib/server/auth", () => authMocks);
vi.mock("@/integrations/supabase/server", () => ({
  createServerSupabaseClient: createServerSupabaseClientMock,
}));

import { GET, POST } from "./route";

describe("admin external room number links API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createServerSupabaseClientMock.mockReturnValue({ from: vi.fn() });
  });

  it("returns room number links with private no-store headers", async () => {
    roomNumberLinkMocks.fetchRoomNumberLinks.mockResolvedValue([
      { id: "link-1", externalNumber: "101", roomId: "room-1" },
    ]);

    const response = await GET(
      new Request("https://airvik.test/api/admin/external-room-links/room-numbers"),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    await expect(response.json()).resolves.toEqual({
      links: [{ id: "link-1", externalNumber: "101", roomId: "room-1" }],
    });
    expect(authMocks.requireAdminProfile).toHaveBeenCalledTimes(1);
  });

  it("saves a room number link without returning the saved row", async () => {
    roomNumberLinkMocks.upsertRoomNumberLink.mockResolvedValue(undefined);

    const response = await POST(
      new Request("https://airvik.test/api/admin/external-room-links/room-numbers", {
        method: "POST",
        body: JSON.stringify({
          source: "vikbooking",
          externalNumber: "101",
          roomId: "00000000-0000-0000-0000-000000000001",
        }),
      }),
    );

    expect(response.status).toBe(204);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    await expect(response.text()).resolves.toBe("");
    expect(roomNumberLinkMocks.upsertRoomNumberLink).toHaveBeenCalledWith(
      expect.anything(),
      {
        source: "vikbooking",
        externalNumber: "101",
        roomId: "00000000-0000-0000-0000-000000000001",
      },
    );
  });
});

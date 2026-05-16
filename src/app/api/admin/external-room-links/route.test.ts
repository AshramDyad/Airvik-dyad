import { beforeEach, describe, expect, it, vi } from "vitest";

const roomLinkMocks = vi.hoisted(() => ({
  fetchExternalRoomLinks: vi.fn(),
  upsertExternalRoomLink: vi.fn(),
  mapRoomLink: vi.fn((row) => row),
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

vi.mock("@/lib/importers/vikbooking/room-links", () => ({
  EXTERNAL_ROOM_LINK_SELECT_COLUMNS:
    "id, source, external_label, room_id, created_at, updated_at",
  ...roomLinkMocks,
}));
vi.mock("@/lib/server/auth", () => authMocks);
vi.mock("@/integrations/supabase/server", () => ({
  createServerSupabaseClient: createServerSupabaseClientMock,
}));

import { GET, POST } from "./route";

describe("admin external room links API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createServerSupabaseClientMock.mockReturnValue({ from: vi.fn() });
  });

  it("returns room links with private no-store headers", async () => {
    roomLinkMocks.fetchExternalRoomLinks.mockResolvedValue([
      { id: "link-1", externalLabel: "Suite A", roomId: "room-1" },
    ]);

    const response = await GET(
      new Request("https://airvik.test/api/admin/external-room-links"),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    await expect(response.json()).resolves.toEqual({
      links: [{ id: "link-1", externalLabel: "Suite A", roomId: "room-1" }],
    });
    expect(authMocks.requireAdminProfile).toHaveBeenCalledTimes(1);
  });

  it("saves a room link without returning the saved row", async () => {
    roomLinkMocks.upsertExternalRoomLink.mockResolvedValue(undefined);

    const response = await POST(
      new Request("https://airvik.test/api/admin/external-room-links", {
        method: "POST",
        body: JSON.stringify({
          source: "vikbooking",
          externalLabel: "Suite A",
          roomId: "00000000-0000-0000-0000-000000000001",
        }),
      }),
    );

    expect(response.status).toBe(204);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    await expect(response.text()).resolves.toBe("");
    expect(roomLinkMocks.upsertExternalRoomLink).toHaveBeenCalledWith(
      expect.anything(),
      {
        source: "vikbooking",
        externalLabel: "Suite A",
        roomId: "00000000-0000-0000-0000-000000000001",
      },
    );
  });
});

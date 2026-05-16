import { beforeEach, describe, expect, it, vi } from "vitest";

const getRoomTypePreviewsMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/server/room-type-preview", () => ({
  getCachedRoomTypePreviews: getRoomTypePreviewsMock,
}));

import { GET } from "./route";

describe("public room type preview API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns compact cached room previews", async () => {
    getRoomTypePreviewsMock.mockResolvedValue([
      {
        id: "annadaan",
        name: "AnnaDaan",
        description: "Featured stay",
        imageUrl: "/anna.jpg",
        amenities: [{ id: "wifi", name: "Wifi", icon: "Wifi" }],
      },
    ]);

    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe(
      "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400",
    );
    await expect(response.json()).resolves.toEqual({
      data: [
        {
          id: "annadaan",
          name: "AnnaDaan",
          description: "Featured stay",
          imageUrl: "/anna.jpg",
          amenities: [{ id: "wifi", name: "Wifi", icon: "Wifi" }],
        },
      ],
    });
  });
});

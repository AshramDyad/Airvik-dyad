import { beforeEach, describe, expect, it, vi } from "vitest";

const getHomepageModalBannerMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/server/events", () => ({
  getHomepageModalBanner: getHomepageModalBannerMock,
}));

import { GET } from "./route";

describe("active event banner API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("serves the cached homepage banner with shared-cache headers", async () => {
    getHomepageModalBannerMock.mockResolvedValue({
      title: "Yoga Camp",
      imageUrl: "https://example.com/event.jpg",
    });

    const response = await GET();

    expect(response.headers.get("Cache-Control")).toBe(
      "public, s-maxage=60, stale-while-revalidate=300"
    );
    await expect(response.json()).resolves.toEqual({
      data: {
        title: "Yoga Camp",
        imageUrl: "https://example.com/event.jpg",
      },
    });
    expect(getHomepageModalBannerMock).toHaveBeenCalledTimes(1);
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const getCachedPublicAppPropertyMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/server/public-property", () => ({
  getCachedPublicAppProperty: getCachedPublicAppPropertyMock,
}));

import { GET } from "./route";

describe("public property API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("serves cached public property fields with shared-cache headers", async () => {
    getCachedPublicAppPropertyMock.mockResolvedValue({
      id: "property-1",
      name: "Airvik",
      currency: "INR",
      tax_enabled: true,
      tax_percentage: 12,
    });

    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe(
      "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400",
    );
    await expect(response.json()).resolves.toEqual({
      data: {
        id: "property-1",
        name: "Airvik",
        currency: "INR",
        tax_enabled: true,
        tax_percentage: 12,
      },
    });
    expect(getCachedPublicAppPropertyMock).toHaveBeenCalledTimes(1);
  });
});

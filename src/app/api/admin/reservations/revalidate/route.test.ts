import { beforeEach, describe, expect, it, vi } from "vitest";

const revalidateTagMock = vi.hoisted(() => vi.fn());
const authMocks = vi.hoisted(() => ({
  requireFeature: vi.fn(),
  HttpError: class HttpError extends Error {
    status: number;

    constructor(message: string, status = 500) {
      super(message);
      this.status = status;
    }
  },
}));

vi.mock("next/cache", () => ({
  revalidateTag: revalidateTagMock,
}));

vi.mock("@/lib/server/auth", () => authMocks);

vi.mock("@/server/reservations/cache", () => ({
  RESERVATIONS_CACHE_TAG: "reservations",
  RESERVATIONS_COUNT_CACHE_TAG: "reservations:count",
}));

import { POST } from "./route";

describe("admin reservation revalidate API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("revalidates reservation tags with private no-store responses", async () => {
    const request = new Request(
      "https://airvik.test/api/admin/reservations/revalidate",
      {
        method: "POST",
      },
    );

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    await expect(response.json()).resolves.toEqual({ revalidated: true });
    expect(authMocks.requireFeature).toHaveBeenCalledWith(
      request,
      "reservations",
    );
    expect(revalidateTagMock).toHaveBeenCalledWith("reservations");
    expect(revalidateTagMock).toHaveBeenCalledWith("reservations:count");
  });
});

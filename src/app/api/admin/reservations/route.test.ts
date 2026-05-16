import { beforeEach, describe, expect, it, vi } from "vitest";

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
const reservationCacheMocks = vi.hoisted(() => ({
  clampReservationPageParams: vi.fn((params) => ({
    limit: params.limit ?? 50,
    offset: params.offset ?? 0,
    query: params.query ?? "",
  })),
  getCachedReservationsCount: vi.fn(),
  getCachedReservationsPage: vi.fn(),
}));

vi.mock("@/lib/server/auth", () => authMocks);
vi.mock("@/server/reservations/cache", () => reservationCacheMocks);

import { GET } from "./route";

describe("admin reservations API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns cached reservation pages with private no-store responses", async () => {
    reservationCacheMocks.getCachedReservationsPage.mockResolvedValue({
      data: [{ id: "reservation-1", bookingId: "BK-1" }],
      nextOffset: 25,
      totalCount: 40,
    });

    const request = new Request(
      "https://airvik.test/api/admin/reservations?limit=25&offset=0&query=asha&includeCount=1",
    );
    const response = await GET(request as never);

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(authMocks.requireFeature).toHaveBeenCalledWith(
      request,
      "reservations",
    );
    expect(reservationCacheMocks.clampReservationPageParams).toHaveBeenCalledWith({
      limit: 25,
      offset: 0,
      query: "asha",
    });
    expect(reservationCacheMocks.getCachedReservationsPage).toHaveBeenCalledWith({
      limit: 25,
      offset: 0,
      query: "asha",
    });
    expect(reservationCacheMocks.getCachedReservationsCount).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual({
      data: [{ id: "reservation-1", bookingId: "BK-1" }],
      nextOffset: 25,
      count: 40,
    });
  });

  it("returns validation errors with private no-store responses", async () => {
    const response = await GET(
      new Request("https://airvik.test/api/admin/reservations?limit=abc") as never,
    );

    expect(response.status).toBe(400);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    await expect(response.json()).resolves.toEqual({
      message: "limit and offset must be numbers",
    });
  });
});

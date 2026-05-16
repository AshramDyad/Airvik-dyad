import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  requireFeature: vi.fn(),
  HttpError: class HttpError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  },
}));
const getGuestReservationsMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/server/auth", () => authMocks);
vi.mock("@/lib/server/guest-reservations", () => ({
  getGuestReservations: getGuestReservationsMock,
}));

import { GET } from "./route";

describe("guest reservations API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requires guest access and returns guest-scoped reservation history without shared caching", async () => {
    getGuestReservationsMock.mockResolvedValue([
      {
        id: "reservation-1",
        bookingId: "booking-1",
        roomId: "room-1",
        status: "Confirmed",
        checkInDate: "2026-05-10",
        checkOutDate: "2026-05-12",
      },
    ]);

    const response = await GET(
      new Request("http://localhost/api/admin/guests/guest-1/reservations") as never,
      { params: Promise.resolve({ id: "guest-1" }) },
    );

    expect(response.status).toBe(200);
    expect(authMocks.requireFeature).toHaveBeenCalledWith(
      expect.any(Request),
      "guests",
    );
    expect(getGuestReservationsMock).toHaveBeenCalledWith("guest-1");
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    await expect(response.json()).resolves.toEqual({
      data: [
        {
          id: "reservation-1",
          bookingId: "booking-1",
          roomId: "room-1",
          status: "Confirmed",
          checkInDate: "2026-05-10",
          checkOutDate: "2026-05-12",
        },
      ],
    });
  });
});

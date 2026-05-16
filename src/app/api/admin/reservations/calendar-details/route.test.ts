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
const getCalendarReservationDetailsMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/server/auth", () => authMocks);
vi.mock("@/lib/server/calendar-reservation-details", () => ({
  getCalendarReservationDetails: getCalendarReservationDetailsMock,
}));

import { GET } from "./route";

describe("calendar reservation details API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requires calendar access and returns bounded reservation hover details", async () => {
    getCalendarReservationDetailsMock.mockResolvedValue([
      {
        id: "reservation-1",
        bookingId: "booking-1",
        guestId: "guest-1",
        roomId: "room-1",
        checkInDate: "2026-05-10",
        checkOutDate: "2026-05-12",
        status: "Confirmed",
        bookingDate: "2026-05-01T00:00:00.000Z",
        adultCount: 2,
        childCount: 0,
        numberOfGuests: 2,
      },
    ]);

    const response = await GET(
      new Request(
        "http://localhost/api/admin/reservations/calendar-details?ids=reservation-1,reservation-2",
      ) as never,
    );

    expect(response.status).toBe(200);
    expect(authMocks.requireFeature).toHaveBeenCalledWith(
      expect.any(Request),
      "calendar",
    );
    expect(getCalendarReservationDetailsMock).toHaveBeenCalledWith([
      "reservation-1",
      "reservation-2",
    ]);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    await expect(response.json()).resolves.toEqual({
      data: [
        {
          id: "reservation-1",
          bookingId: "booking-1",
          guestId: "guest-1",
          roomId: "room-1",
          checkInDate: "2026-05-10",
          checkOutDate: "2026-05-12",
          status: "Confirmed",
          bookingDate: "2026-05-01T00:00:00.000Z",
          adultCount: 2,
          childCount: 0,
          numberOfGuests: 2,
        },
      ],
    });
  });

  it("returns an empty payload without querying when no ids are supplied", async () => {
    const response = await GET(
      new Request("http://localhost/api/admin/reservations/calendar-details") as never,
    );

    expect(response.status).toBe(200);
    expect(getCalendarReservationDetailsMock).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual({ data: [] });
  });
});

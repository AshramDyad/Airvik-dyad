import { beforeEach, describe, expect, it, vi } from "vitest";

const getPublicBookingConfirmationMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/server/booking-confirmation", () => ({
  getPublicBookingConfirmation: getPublicBookingConfirmationMock,
}));

import { GET } from "./route";

describe("public booking confirmation API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns one confirmation payload with no-store headers", async () => {
    const confirmation = {
      reservation: { id: "reservation-1" },
      bookingReservations: [{ id: "reservation-1" }],
      guest: { id: "guest-1" },
      rooms: [{ id: "room-1" }],
      roomTypes: [{ id: "room-type-1" }],
    };
    getPublicBookingConfirmationMock.mockResolvedValue(confirmation);

    const response = await GET(
      new Request("http://localhost/api/bookings/confirmation/reservation-1"),
      { params: Promise.resolve({ id: "reservation-1" }) },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(getPublicBookingConfirmationMock).toHaveBeenCalledWith("reservation-1");
    await expect(response.json()).resolves.toEqual({ data: confirmation });
  });

  it("rejects missing reservation ids before querying Supabase", async () => {
    const response = await GET(
      new Request("http://localhost/api/bookings/confirmation/%20"),
      { params: Promise.resolve({ id: " " }) },
    );

    expect(response.status).toBe(400);
    expect(getPublicBookingConfirmationMock).not.toHaveBeenCalled();
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const createPublicBookingMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/server/public-booking", () => ({
  createPublicBooking: createPublicBookingMock,
}));

import { POST } from "./route";

describe("public booking API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a public booking with no-store headers", async () => {
    const booking = {
      confirmationReservationId: "reservation-1",
      reservations: [{ id: "reservation-1" }],
    };
    createPublicBookingMock.mockResolvedValue(booking);

    const payload = {
      roomTypeIds: ["room-type-1"],
      checkIn: "2026-06-10",
      checkOut: "2026-06-12",
      adults: 2,
      children: 1,
      specialRequests: "Near the lift",
      guest: {
        firstName: "Nirav",
        lastName: "Patel",
        email: "nirav@example.com",
        phone: "+91 9999999999",
        address: "123 Test Street",
        pincode: "380001",
        city: "Ahmedabad",
        state: "Gujarat",
        country: "IN",
      },
    };

    const response = await POST(
      new Request("http://localhost/api/bookings/public", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(createPublicBookingMock).toHaveBeenCalledWith(payload);
    await expect(response.json()).resolves.toEqual({ data: booking });
  });

  it("rejects invalid date ranges before querying Supabase", async () => {
    const response = await POST(
      new Request("http://localhost/api/bookings/public", {
        method: "POST",
        body: JSON.stringify({
          roomTypeIds: ["room-type-1"],
          checkIn: "2026-06-12",
          checkOut: "2026-06-10",
          adults: 2,
          children: 0,
          guest: {
            firstName: "Nirav",
            lastName: "Patel",
            phone: "+91 9999999999",
            address: "123 Test Street",
            city: "Ahmedabad",
            country: "IN",
          },
        }),
      }),
    );

    expect(response.status).toBe(400);
    expect(createPublicBookingMock).not.toHaveBeenCalled();
  });
});

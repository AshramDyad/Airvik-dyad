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
const getAdminReservationBookingDetailsMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/server/auth", () => authMocks);
vi.mock("@/lib/server/admin-reservation-booking", () => ({
  getAdminReservationBookingDetails: getAdminReservationBookingDetailsMock,
}));

import { GET } from "./route";

describe("admin reservation booking API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requires reservation access and returns one booking payload without shared caching", async () => {
    const bookingDetails = {
      reservations: [{ id: "reservation-1" }],
      guest: { id: "guest-1" },
      rooms: [{ id: "room-1" }],
      roomTypes: [{ id: "type-1" }],
      ratePlans: [{ id: "rate-plan-1" }],
    };
    getAdminReservationBookingDetailsMock.mockResolvedValue(bookingDetails);

    const response = await GET(
      new Request("http://localhost/api/admin/reservations/reservation-1/booking") as never,
      { params: Promise.resolve({ id: "reservation-1" }) },
    );

    expect(response.status).toBe(200);
    expect(authMocks.requireFeature).toHaveBeenCalledWith(
      expect.any(Request),
      "reservations",
    );
    expect(getAdminReservationBookingDetailsMock).toHaveBeenCalledWith(
      "reservation-1",
    );
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    await expect(response.json()).resolves.toEqual({
      data: bookingDetails,
    });
  });

  it("rejects missing reservation ids before querying Supabase", async () => {
    const response = await GET(
      new Request("http://localhost/api/admin/reservations/%20/booking") as never,
      { params: Promise.resolve({ id: " " }) },
    );

    expect(response.status).toBe(400);
    expect(getAdminReservationBookingDetailsMock).not.toHaveBeenCalled();
  });
});

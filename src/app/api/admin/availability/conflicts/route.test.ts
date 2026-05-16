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
const getAdminReservationConflictingRoomIdsMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/server/auth", () => authMocks);
vi.mock("@/lib/server/reservation-conflicts", () => ({
  getAdminReservationConflictingRoomIds:
    getAdminReservationConflictingRoomIdsMock,
}));

import { GET } from "./route";

describe("admin reservation conflict API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requires reservation creation access and returns no-store conflict ids", async () => {
    getAdminReservationConflictingRoomIdsMock.mockResolvedValue([
      "room-2",
      "room-1",
    ]);

    const response = await GET(
      new Request(
        "http://localhost/api/admin/availability/conflicts?checkIn=2026-06-10&checkOut=2026-06-12",
      ) as never,
    );

    expect(response.status).toBe(200);
    expect(authMocks.requireFeature).toHaveBeenCalledWith(
      expect.any(Request),
      "reservationCreate",
    );
    expect(getAdminReservationConflictingRoomIdsMock).toHaveBeenCalledWith({
      checkIn: "2026-06-10",
      checkOut: "2026-06-12",
    });
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    await expect(response.json()).resolves.toEqual({
      data: { roomIds: ["room-2", "room-1"] },
    });
  });

  it("rejects invalid date ranges before querying Supabase", async () => {
    const response = await GET(
      new Request(
        "http://localhost/api/admin/availability/conflicts?checkIn=2026-06-12&checkOut=2026-06-10",
      ) as never,
    );

    expect(response.status).toBe(400);
    expect(getAdminReservationConflictingRoomIdsMock).not.toHaveBeenCalled();
  });
});

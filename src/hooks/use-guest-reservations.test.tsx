import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authorizedFetchMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/client-session", () => ({
  authorizedFetch: authorizedFetchMock,
}));

import { useGuestReservations } from "./use-guest-reservations";

describe("useGuestReservations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authorizedFetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [
            {
              id: "reservation-1",
              bookingId: "booking-1",
              roomId: "room-1",
              status: "Confirmed",
              checkInDate: "2026-05-10",
              checkOutDate: "2026-05-12",
              roomNumber: "101",
            },
          ],
        }),
        { status: 200 },
      ),
    );
  });

  it("fetches only the selected guest's reservation history", async () => {
    const { result } = renderHook(() => useGuestReservations("guest-1"));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(authorizedFetchMock).toHaveBeenCalledWith(
      "/api/admin/guests/guest-1/reservations",
      expect.objectContaining({
        cache: "no-store",
        signal: expect.any(AbortSignal),
      }),
    );
    expect(result.current.reservations).toEqual([
      {
        id: "reservation-1",
        bookingId: "booking-1",
        roomId: "room-1",
        status: "Confirmed",
        checkInDate: "2026-05-10",
        checkOutDate: "2026-05-12",
        roomNumber: "101",
      },
    ]);
    expect(result.current.error).toBeNull();
  });
});

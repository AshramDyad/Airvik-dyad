import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authorizedFetchMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/client-session", () => ({
  authorizedFetch: authorizedFetchMock,
}));

import { useCalendarReservationDetails } from "./use-calendar-reservation-details";

describe("useCalendarReservationDetails", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authorizedFetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
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
        }),
        { status: 200 },
      ),
    );
  });

  it("fetches unique calendar reservation details through the admin API", async () => {
    const { result } = renderHook(() =>
      useCalendarReservationDetails(["reservation-2", "reservation-1", "reservation-2"]),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(authorizedFetchMock).toHaveBeenCalledWith(
      "/api/admin/reservations/calendar-details?ids=reservation-1%2Creservation-2",
      expect.objectContaining({
        cache: "no-store",
        signal: expect.any(AbortSignal),
      }),
    );
    expect(result.current.detailsById.get("reservation-1")).toMatchObject({
      id: "reservation-1",
      bookingId: "booking-1",
    });
    expect(result.current.error).toBeNull();
  });

  it("does not fetch when there are no visible reservation ids", async () => {
    const { result } = renderHook(() => useCalendarReservationDetails([]));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(authorizedFetchMock).not.toHaveBeenCalled();
    expect(result.current.detailsById.size).toBe(0);
  });
});

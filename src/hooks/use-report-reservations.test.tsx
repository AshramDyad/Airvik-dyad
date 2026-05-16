import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authorizedFetchMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/client-session", () => ({
  authorizedFetch: authorizedFetchMock,
}));

import { useReportReservations } from "./use-report-reservations";

describe("useReportReservations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authorizedFetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [
            {
              id: "reservation-1",
              checkInDate: "2026-05-10",
              checkOutDate: "2026-05-12",
              status: "Checked-out",
              totalAmount: 5000,
            },
          ],
          roomsForSaleCount: 3,
        }),
        { status: 200 },
      ),
    );
  });

  it("fetches report reservations for the selected date range through the admin API", async () => {
    const { result } = renderHook(() =>
      useReportReservations({
        from: new Date(2026, 4, 1),
        to: new Date(2026, 4, 31),
      }),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(authorizedFetchMock).toHaveBeenCalledWith(
      "/api/admin/reports/reservations?from=2026-05-01&to=2026-05-31",
      expect.objectContaining({
        cache: "no-store",
        signal: expect.any(AbortSignal),
      }),
    );
    expect(result.current.reservations).toEqual([
      {
        id: "reservation-1",
        checkInDate: "2026-05-10",
        checkOutDate: "2026-05-12",
        status: "Checked-out",
        totalAmount: 5000,
      },
    ]);
    expect(result.current.roomsForSaleCount).toBe(3);
    expect(result.current.error).toBeNull();
  });
});

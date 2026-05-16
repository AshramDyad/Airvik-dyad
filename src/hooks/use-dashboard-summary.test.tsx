import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authorizedFetchMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/client-session", () => ({
  authorizedFetch: authorizedFetchMock,
}));

import { useDashboardSummary } from "./use-dashboard-summary";

describe("useDashboardSummary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authorizedFetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            occupancyPercentage: 50,
            occupiedRoomsCount: 2,
            availableRooms: 2,
            roomsForSaleCount: 4,
            arrivalsRows: [
              {
                id: "arrival-1",
                guestName: "Asha Guest",
                guestEmail: "asha@example.com",
                roomNumber: "101",
                status: "Confirmed",
              },
            ],
            departuresRows: [],
          },
        }),
        { status: 200 },
      ),
    );
  });

  it("fetches the compact dashboard summary through the admin API", async () => {
    const { result } = renderHook(() => useDashboardSummary("2026-05-13"));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(authorizedFetchMock).toHaveBeenCalledWith(
      "/api/admin/dashboard/summary?date=2026-05-13",
      expect.objectContaining({
        cache: "no-store",
        signal: expect.any(AbortSignal),
      }),
    );
    expect(result.current.summary).toMatchObject({
      occupancyPercentage: 50,
      occupiedRoomsCount: 2,
      arrivalsRows: [
        {
          id: "arrival-1",
          guestName: "Asha Guest",
        },
      ],
    });
    expect(result.current.error).toBeNull();
  });
});

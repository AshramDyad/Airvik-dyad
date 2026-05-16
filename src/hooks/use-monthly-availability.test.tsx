import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authorizedFetchMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/client-session", () => ({
  authorizedFetch: authorizedFetchMock,
}));

import { useMonthlyAvailability } from "./use-monthly-availability";

describe("useMonthlyAvailability", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authorizedFetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [
            {
              roomType: {
                id: "room-type-1",
                name: "Deluxe",
                description: "",
                rooms: [],
                units: 0,
                sharedInventory: false,
              },
              availability: [],
            },
          ],
        }),
        { status: 200 },
      ),
    );
  });

  it("loads monthly availability through the authenticated admin API", async () => {
    const { result } = renderHook(() =>
      useMonthlyAvailability(new Date(2026, 4, 13), ["rt-2", "rt-1"]),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(authorizedFetchMock).toHaveBeenCalledWith(
      "/api/admin/availability/monthly?monthStart=2026-05-01&roomTypeIds=rt-1%2Crt-2",
      expect.objectContaining({
        cache: "no-store",
      }),
    );
    expect(result.current.data).toEqual([
      {
        roomType: {
          id: "room-type-1",
          name: "Deluxe",
          description: "",
          rooms: [],
          units: 0,
          sharedInventory: false,
        },
        availability: [],
      },
    ]);
    expect(result.current.error).toBeNull();
  });
});

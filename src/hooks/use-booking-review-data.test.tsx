import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useBookingReviewData } from "./use-booking-review-data";

describe("useBookingReviewData", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            data: {
              roomTypes: [{ id: "room-type-1", name: "Ganga View" }],
              ratePlan: null,
              seasonalPrices: [],
              propertyClosures: [],
            },
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      ),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fetches selected-room review data through the public API", async () => {
    const { result } = renderHook(() =>
      useBookingReviewData({
        roomTypeIds: ["room-type-1", "room-type-1"],
        checkIn: "2026-10-04",
        checkOut: "2026-10-06",
      }),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(fetch).toHaveBeenCalledWith(
      "/api/bookings/review-data?roomTypeId=room-type-1&roomTypeId=room-type-1&from=2026-10-04&to=2026-10-06",
      {
        cache: "force-cache",
        signal: expect.any(AbortSignal),
      },
    );
    expect(result.current.reviewData?.roomTypes[0].id).toBe("room-type-1");
    expect(result.current.error).toBeNull();
  });

  it("does not fetch until selected room ids and dates exist", () => {
    const { result } = renderHook(() =>
      useBookingReviewData({
        roomTypeIds: [],
        checkIn: null,
        checkOut: null,
      }),
    );

    expect(fetch).not.toHaveBeenCalled();
    expect(result.current.reviewData).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });
});

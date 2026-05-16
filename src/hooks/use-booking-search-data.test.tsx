import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useBookingSearchData } from "./use-booking-search-data";

describe("useBookingSearchData", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            data: {
              roomTypes: [{ id: "room-type-1", name: "Ganga View" }],
              amenities: [{ id: "wifi", name: "Wifi", icon: "Wifi" }],
              ratePlan: { id: "standard", name: "Standard Rate" },
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

  it("fetches compact booking search metadata through the public API", async () => {
    const { result } = renderHook(() => useBookingSearchData());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(fetch).toHaveBeenCalledWith("/api/bookings/search-data", {
      cache: "force-cache",
      signal: expect.any(AbortSignal),
    });
    expect(result.current.bookingSearchData?.roomTypes[0].id).toBe(
      "room-type-1",
    );
    expect(result.current.error).toBeNull();
  });

  it("can defer fetching until a booking dialog or page needs the metadata", () => {
    const { result } = renderHook(() => useBookingSearchData(false));

    expect(fetch).not.toHaveBeenCalled();
    expect(result.current.bookingSearchData).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });
});

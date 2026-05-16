import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useRoomTypeDetail } from "./use-room-type-detail";

describe("useRoomTypeDetail", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            data: {
              roomType: { id: "room-type-1", name: "Ganga View" },
              relatedRoomTypes: [],
              amenities: [],
              standardRatePlan: null,
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

  it("fetches only the selected room type detail payload", async () => {
    const { result } = renderHook(() => useRoomTypeDetail("room-type-1"));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(fetch).toHaveBeenCalledWith("/api/room-types/room-type-1/detail", {
      cache: "force-cache",
      signal: expect.any(AbortSignal),
    });
    expect(result.current.detail?.roomType.id).toBe("room-type-1");
    expect(result.current.error).toBeNull();
  });

  it("does not fetch detail data until a room type id exists", () => {
    const { result } = renderHook(() => useRoomTypeDetail(""));

    expect(fetch).not.toHaveBeenCalled();
    expect(result.current.detail).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });
});

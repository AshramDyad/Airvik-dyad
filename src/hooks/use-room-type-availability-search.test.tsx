import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useRoomTypeAvailabilitySearch } from "./use-room-type-availability-search";

describe("useRoomTypeAvailabilitySearch", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            data: {
              availableRoomTypeIds: ["type-1"],
              roomTypeAvailability: [
                { roomTypeId: "type-1", availableRooms: 2 },
              ],
              hasNoInventory: false,
              isDatesBlocked: false,
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

  it("does not call the availability API until a complete date range exists", () => {
    const { result } = renderHook(() =>
      useRoomTypeAvailabilitySearch({
        roomTypeId: "type-1",
        dateRange: { from: new Date("2026-06-10T00:00:00") },
        adults: 2,
        children: 0,
      }),
    );

    expect(fetch).not.toHaveBeenCalled();
    expect(result.current.availableRoomsForStay).toBeUndefined();
    expect(result.current.isCheckingAvailability).toBe(false);
  });

  it("posts selected dates to the no-store availability API and maps the room type summary", async () => {
    const { result } = renderHook(() =>
      useRoomTypeAvailabilitySearch({
        roomTypeId: "type-1",
        dateRange: {
          from: new Date("2026-06-10T00:00:00"),
          to: new Date("2026-06-12T00:00:00"),
        },
        adults: 2,
        children: 1,
      }),
    );

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));

    expect(fetch).toHaveBeenCalledWith("/api/availability/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({
        checkIn: "2026-06-10",
        checkOut: "2026-06-12",
        roomTypeIds: ["type-1"],
        roomOccupancies: [{ adults: 2, children: 1 }],
      }),
    });
    await waitFor(() => expect(result.current.availableRoomsForStay).toBe(2));
    expect(result.current.isDatesBlocked).toBe(false);
  });

  it("returns zero available rooms when the room type is absent from the API summary", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: {
            availableRoomTypeIds: [],
            roomTypeAvailability: [],
            hasNoInventory: false,
            isDatesBlocked: true,
          },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    const { result } = renderHook(() =>
      useRoomTypeAvailabilitySearch({
        roomTypeId: "type-1",
        dateRange: {
          from: new Date("2026-06-10T00:00:00"),
          to: new Date("2026-06-12T00:00:00"),
        },
        adults: 2,
        children: 0,
      }),
    );

    await waitFor(() => expect(result.current.availableRoomsForStay).toBe(0));
    expect(result.current.isDatesBlocked).toBe(true);
  });
});

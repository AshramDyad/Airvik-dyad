import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useAvailabilitySearch } from "./use-availability-search";

const roomTypes = [
  {
    id: "type-1",
    name: "Deluxe",
    description: "",
    maxOccupancy: 2,
    minOccupancy: 1,
    maxChildren: 0,
    bedTypes: ["Queen"],
    price: 100,
    amenities: [],
    photos: [],
    isVisible: true,
  },
  {
    id: "type-hidden",
    name: "Hidden",
    description: "",
    maxOccupancy: 2,
    minOccupancy: 1,
    maxChildren: 0,
    bedTypes: ["Queen"],
    price: 100,
    amenities: [],
    photos: [],
    isVisible: false,
  },
];

const propertyClosures = [
  {
    id: "closure-1",
    propertyId: "property-1",
    startDate: "2026-05-20",
    endDate: "2026-05-22",
    reason: "Maintenance",
  },
];

describe("useAvailabilitySearch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            data: {
              availableRoomTypeIds: ["type-1"],
              roomTypeAvailability: [{ roomTypeId: "type-1", availableRooms: 2 }],
              seasonalPrices: [
                {
                  id: "season-1",
                  roomTypeId: "type-1",
                  name: "Festival",
                  price: 150,
                  startDate: "2026-06-10",
                  endDate: "2026-06-12",
                },
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
    vi.useRealTimers();
  });

  it("uses route-backed property closures passed by the caller", () => {
    const { result } = renderHook(() =>
      useAvailabilitySearch({ roomTypes, propertyClosures }),
    );

    expect(result.current.closures).toEqual(propertyClosures);
  });

  it("posts searches to the public availability API and maps returned room type ids", async () => {
    const { result } = renderHook(() =>
      useAvailabilitySearch({ roomTypes, propertyClosures }),
    );

    act(() => {
      result.current.search(
        {
          from: new Date("2026-06-10T00:00:00"),
          to: new Date("2026-06-12T00:00:00"),
        },
        [{ adults: 2, children: 0 }],
        ["category-1"],
      );
    });

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(fetch).toHaveBeenCalledWith("/api/availability/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({
        checkIn: "2026-06-10",
        checkOut: "2026-06-12",
        roomOccupancies: [{ adults: 2, children: 0 }],
        categoryIds: ["category-1"],
      }),
    });
    expect(result.current.availableRoomTypes?.map((roomType) => roomType.id)).toEqual(["type-1"]);
    expect(result.current.roomTypeAvailability).toEqual([
      { roomTypeId: "type-1", availableRooms: 2 },
    ]);
    expect(result.current.seasonalPrices).toEqual([
      {
        id: "season-1",
        roomTypeId: "type-1",
        name: "Festival",
        price: 150,
        startDate: "2026-06-10",
        endDate: "2026-06-12",
      },
    ]);
  });
});

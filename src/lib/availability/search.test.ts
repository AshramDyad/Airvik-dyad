import { describe, expect, it } from "vitest";

import {
  computeAvailabilitySearchResult,
  type AvailabilitySearchInput,
} from "./search";

const baseInput: AvailabilitySearchInput = {
  checkIn: new Date("2026-06-10T00:00:00"),
  checkOut: new Date("2026-06-12T00:00:00"),
  roomOccupancies: [{ adults: 2, children: 0 }],
  rooms: [
    { id: "room-1", roomTypeId: "type-1", status: "Clean" },
    { id: "room-2", roomTypeId: "type-1", status: "Dirty" },
    { id: "room-3", roomTypeId: "type-2", status: "Maintenance" },
  ],
  roomTypes: [
    {
      id: "type-1",
      maxOccupancy: 2,
      minOccupancy: 1,
      isVisible: true,
    },
    {
      id: "type-2",
      maxOccupancy: 4,
      minOccupancy: 1,
      isVisible: true,
    },
  ],
  reservations: [],
  restrictions: [],
  closures: [],
};

describe("computeAvailabilitySearchResult", () => {
  it("returns availability without exposing reservation details", () => {
    const result = computeAvailabilitySearchResult({
      ...baseInput,
      reservations: [
        {
          id: "reservation-1",
          roomId: "room-1",
          checkInDate: "2026-06-10",
          checkOutDate: "2026-06-12",
          status: "Confirmed",
        },
      ],
    });

    expect(result).toEqual({
      availableRoomTypeIds: ["type-1"],
      roomTypeAvailability: [{ roomTypeId: "type-1", availableRooms: 1 }],
      seasonalPrices: [],
      hasNoInventory: false,
      isDatesBlocked: false,
    });
  });

  it("marks dates blocked when closures filter every otherwise available room type", () => {
    const result = computeAvailabilitySearchResult({
      ...baseInput,
      closures: [
        {
          id: "closure-1",
          propertyId: "property-1",
          startDate: "2026-06-09",
          endDate: "2026-06-12",
          reason: "Maintenance",
        },
      ],
    });

    expect(result.availableRoomTypeIds).toEqual([]);
    expect(result.roomTypeAvailability).toEqual([]);
    expect(result.isDatesBlocked).toBe(true);
  });

  it("applies minimum stay restrictions before returning a room type", () => {
    const result = computeAvailabilitySearchResult({
      ...baseInput,
      restrictions: [
        {
          id: "restriction-1",
          restrictionType: "min_stay",
          roomTypeId: "type-1",
          value: { minNights: 3 },
        },
      ],
    });

    expect(result.availableRoomTypeIds).toEqual([]);
    expect(result.roomTypeAvailability).toEqual([]);
  });

  it("marks the response as no inventory when rooms are not configured", () => {
    const result = computeAvailabilitySearchResult({
      ...baseInput,
      rooms: [],
    });

    expect(result.availableRoomTypeIds).toEqual(["type-1", "type-2"]);
    expect(result.roomTypeAvailability).toEqual([]);
    expect(result.hasNoInventory).toBe(true);
  });
});

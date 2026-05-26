import { beforeEach, describe, expect, it } from "vitest";

import {
  buildRatePlan,
  buildReservation,
  buildRoom,
  buildRoomType,
  buildSeasonalPrice,
  resetBuilderSequences,
} from "@/test/builders";

import { deriveSavedCustomNightlyRates } from "./custom-pricing";

describe("deriveSavedCustomNightlyRates", () => {
  beforeEach(() => {
    resetBuilderSequences();
  });

  it("keeps a saved custom price when it differs from the seasonal rate", () => {
    const roomType = buildRoomType({
      id: "vidhya-dan",
      name: "VidhyaDan",
      price: 3600,
    });
    const room = buildRoom({ id: "room-211", roomTypeId: roomType.id });
    const reservation = buildReservation({
      roomId: room.id,
      totalAmount: 3800,
      checkInDate: "2026-05-28",
      checkOutDate: "2026-05-29",
    });
    const seasonalPrice = buildSeasonalPrice({
      roomTypeId: roomType.id,
      price: 3900,
      startDate: "2026-04-01",
      endDate: "2026-06-30",
    });

    expect(
      deriveSavedCustomNightlyRates({
        reservations: [reservation],
        rooms: [room],
        roomTypes: [roomType],
        ratePlan: buildRatePlan({ price: 3000 }),
        seasonalPrices: [seasonalPrice],
        stayNights: 1,
        checkInDate: "2026-05-28",
      })
    ).toEqual({ [roomType.id]: 3800 });
  });

  it("does not create an override when saved price matches the seasonal rate", () => {
    const roomType = buildRoomType({ id: "vidhya-dan", price: 3600 });
    const room = buildRoom({ id: "room-211", roomTypeId: roomType.id });
    const reservation = buildReservation({
      roomId: room.id,
      totalAmount: 3900,
    });
    const seasonalPrice = buildSeasonalPrice({
      roomTypeId: roomType.id,
      price: 3900,
    });

    expect(
      deriveSavedCustomNightlyRates({
        reservations: [reservation],
        rooms: [room],
        roomTypes: [roomType],
        ratePlan: buildRatePlan({ price: 3000 }),
        seasonalPrices: [seasonalPrice],
        stayNights: 1,
        checkInDate: "2026-05-28",
      })
    ).toEqual({});
  });

  it("does not create an override when saved price matches the default room type price", () => {
    const roomType = buildRoomType({ id: "vidhya-dan", price: 3600 });
    const room = buildRoom({ id: "room-211", roomTypeId: roomType.id });
    const reservation = buildReservation({
      roomId: room.id,
      totalAmount: 3600,
    });

    expect(
      deriveSavedCustomNightlyRates({
        reservations: [reservation],
        rooms: [room],
        roomTypes: [roomType],
        ratePlan: buildRatePlan({ price: 3000 }),
        seasonalPrices: [],
        stayNights: 1,
        checkInDate: "2026-05-28",
      })
    ).toEqual({});
  });

  it("derives the saved custom nightly price for multi-night reservations", () => {
    const roomType = buildRoomType({ id: "vidhya-dan", price: 3600 });
    const room = buildRoom({ id: "room-211", roomTypeId: roomType.id });
    const reservation = buildReservation({
      roomId: room.id,
      totalAmount: 7600,
      checkInDate: "2026-05-28",
      checkOutDate: "2026-05-30",
    });

    expect(
      deriveSavedCustomNightlyRates({
        reservations: [reservation],
        rooms: [room],
        roomTypes: [roomType],
        ratePlan: buildRatePlan({ price: 3000 }),
        seasonalPrices: [],
        stayNights: 2,
        checkInDate: "2026-05-28",
      })
    ).toEqual({ [roomType.id]: 3800 });
  });

  it("ignores reservations when the room or room type cannot be resolved", () => {
    const roomType = buildRoomType({ id: "vidhya-dan", price: 3600 });
    const room = buildRoom({ id: "room-211", roomTypeId: roomType.id });
    const reservation = buildReservation({
      roomId: "missing-room",
      totalAmount: 3800,
    });

    expect(
      deriveSavedCustomNightlyRates({
        reservations: [reservation],
        rooms: [room],
        roomTypes: [roomType],
        ratePlan: buildRatePlan({ price: 3000 }),
        seasonalPrices: [],
        stayNights: 1,
        checkInDate: "2026-05-28",
      })
    ).toEqual({});
  });
});

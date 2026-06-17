import { describe, expect, it } from "vitest";

import { buildRatePlan, buildRoomType } from "@/test/builders";

import {
  computeBookingAmounts,
  DISCOUNT_OTP_THRESHOLD,
  maxNightlyDiscount,
  requiresApproval,
} from "./discount-approval";

describe("requiresApproval", () => {
  it("triggers only when the discount exceeds the threshold", () => {
    expect(requiresApproval(DISCOUNT_OTP_THRESHOLD)).toBe(false);
    expect(requiresApproval(DISCOUNT_OTP_THRESHOLD + 1)).toBe(true);
    expect(requiresApproval(0)).toBe(false);
  });
});

describe("maxNightlyDiscount", () => {
  const ratePlan = buildRatePlan({ price: 3000 });

  it("returns 0 when no overrides are set", () => {
    const roomType = buildRoomType({ id: "rt-1", price: 2400 });
    expect(
      maxNightlyDiscount({ roomTypes: [roomType], overrides: {}, ratePlan })
    ).toBe(0);
  });

  it("matches the 2400 -> 2000 example (400 off)", () => {
    const roomType = buildRoomType({ id: "rt-1", price: 2400 });
    const discount = maxNightlyDiscount({
      roomTypes: [roomType],
      overrides: { "rt-1": 2000 },
      ratePlan,
    });
    expect(discount).toBe(400);
    expect(requiresApproval(discount)).toBe(true);
  });

  it("ignores a small discount within the limit", () => {
    const roomType = buildRoomType({ id: "rt-1", price: 2400 });
    const discount = maxNightlyDiscount({
      roomTypes: [roomType],
      overrides: { "rt-1": 2200 },
      ratePlan,
    });
    expect(discount).toBe(200);
    expect(requiresApproval(discount)).toBe(false);
  });

  it("uses the largest per-room-type discount", () => {
    const small = buildRoomType({ id: "rt-small", price: 2000 });
    const big = buildRoomType({ id: "rt-big", price: 5000 });
    const discount = maxNightlyDiscount({
      roomTypes: [small, big],
      overrides: { "rt-small": 1900, "rt-big": 4000 },
      ratePlan,
    });
    expect(discount).toBe(1000);
  });

  it("ignores non-positive overrides", () => {
    const roomType = buildRoomType({ id: "rt-1", price: 2400 });
    expect(
      maxNightlyDiscount({ roomTypes: [roomType], overrides: { "rt-1": 0 }, ratePlan })
    ).toBe(0);
  });
});

describe("computeBookingAmounts", () => {
  const ratePlan = buildRatePlan({ price: 3000 });

  it("computes original vs custom totals across nights and rooms", () => {
    const roomType = buildRoomType({ id: "rt-1", price: 2400 });
    const amounts = computeBookingAmounts({
      roomTypesPerRoom: [roomType, roomType],
      overrides: { "rt-1": 2000 },
      ratePlan,
      nights: 3,
    });
    // 2 rooms x 3 nights: original 2400, custom 2000
    expect(amounts.originalAmount).toBe(2 * 3 * 2400);
    expect(amounts.customAmount).toBe(2 * 3 * 2000);
  });

  it("falls back to the normal rate when a room type has no override", () => {
    const overridden = buildRoomType({ id: "rt-1", price: 2400 });
    const plain = buildRoomType({ id: "rt-2", price: 1800 });
    const amounts = computeBookingAmounts({
      roomTypesPerRoom: [overridden, plain],
      overrides: { "rt-1": 2000 },
      ratePlan,
      nights: 1,
    });
    expect(amounts.originalAmount).toBe(2400 + 1800);
    expect(amounts.customAmount).toBe(2000 + 1800);
  });
});

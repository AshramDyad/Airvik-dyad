import type { RatePlan, RoomType } from "@/data/types";
import { resolveRoomNightlyRate, type RoomPricingOverrides } from "@/lib/pricing-calculator";

/**
 * Reservation discount approval.
 *
 * When an admin lowers a room's nightly rate by more than this many rupees (vs the
 * normal rate the admin sees in the "Custom Prices" card), the booking needs an owner
 * OTP before it can be created. The baseline uses `resolveRoomNightlyRate` with only
 * `{ roomType, ratePlan }` — exactly what the Custom Prices card shows as "Default …/night"
 * — so the gate never fires against a number the admin can't see.
 */
export const DISCOUNT_OTP_THRESHOLD =
  Number(process.env.NEXT_PUBLIC_DISCOUNT_OTP_THRESHOLD) || 300;

export function requiresApproval(discount: number): boolean {
  return discount > DISCOUNT_OTP_THRESHOLD;
}

/** Largest per-night discount across the selected room types (0 if none discounted). */
export function maxNightlyDiscount({
  roomTypes,
  overrides,
  ratePlan,
}: {
  roomTypes: RoomType[];
  overrides: RoomPricingOverrides;
  ratePlan?: RatePlan | null;
}): number {
  let largest = 0;
  for (const roomType of roomTypes) {
    const override = overrides[roomType.id];
    if (typeof override !== "number" || override <= 0) continue;
    const normalNightly = resolveRoomNightlyRate({ roomType, ratePlan });
    const discount = normalNightly - override;
    if (discount > largest) largest = discount;
  }
  return largest;
}

/**
 * Booking totals for the approval message: `originalAmount` uses each room's normal
 * nightly rate; `customAmount` uses the override where one is set. One entry per booked
 * room (so multiple rooms of the same type are counted individually).
 */
export function computeBookingAmounts({
  roomTypesPerRoom,
  overrides,
  ratePlan,
  nights,
}: {
  roomTypesPerRoom: RoomType[];
  overrides: RoomPricingOverrides;
  ratePlan?: RatePlan | null;
  nights: number;
}): { originalAmount: number; customAmount: number } {
  let originalAmount = 0;
  let customAmount = 0;
  for (const roomType of roomTypesPerRoom) {
    const normalNightly = resolveRoomNightlyRate({ roomType, ratePlan });
    const override = overrides[roomType.id];
    const effectiveNightly =
      typeof override === "number" && override > 0 ? override : normalNightly;
    originalAmount += normalNightly * nights;
    customAmount += effectiveNightly * nights;
  }
  return { originalAmount, customAmount };
}

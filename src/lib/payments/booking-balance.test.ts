import { describe, expect, it } from "vitest";

import type { FolioItem } from "@/data/types";

import {
  computeBookingBalanceDue,
  type BookingBalanceReservation,
} from "./booking-balance";

function folioItem(amount: number): FolioItem {
  return {
    id: `folio-${amount}`,
    description: amount < 0 ? "Payment" : "Charge",
    amount,
    timestamp: "2026-06-08T00:00:00.000Z",
  };
}

function reservation(
  overrides: Partial<BookingBalanceReservation> = {}
): BookingBalanceReservation {
  return {
    totalAmount: 1000,
    folio: [],
    taxEnabledSnapshot: false,
    taxRateSnapshot: 0,
    ...overrides,
  };
}

describe("computeBookingBalanceDue", () => {
  it("returns the room charge when there is no tax and nothing paid", () => {
    expect(computeBookingBalanceDue([reservation({ totalAmount: 1500 })])).toBe(
      1500
    );
  });

  it("adds per-reservation tax from the snapshot", () => {
    const total = computeBookingBalanceDue([
      reservation({
        totalAmount: 1000,
        taxEnabledSnapshot: true,
        taxRateSnapshot: 0.12,
      }),
    ]);

    expect(total).toBe(1120);
  });

  it("subtracts payments (negative folio items) from the balance", () => {
    const total = computeBookingBalanceDue([
      reservation({ totalAmount: 1000, folio: [folioItem(-400)] }),
    ]);

    expect(total).toBe(600);
  });

  it("sums the balance across every room in the booking", () => {
    const total = computeBookingBalanceDue([
      reservation({ totalAmount: 1000 }),
      reservation({ totalAmount: 2500 }),
    ]);

    expect(total).toBe(3500);
  });

  it("never lets a fully-paid room reduce the total below the rest", () => {
    const total = computeBookingBalanceDue([
      reservation({ totalAmount: 1000, folio: [folioItem(-5000)] }), // overpaid → clamps to 0
      reservation({ totalAmount: 800 }),
    ]);

    expect(total).toBe(800);
  });

  it("returns 0 for an empty booking", () => {
    expect(computeBookingBalanceDue([])).toBe(0);
  });
});

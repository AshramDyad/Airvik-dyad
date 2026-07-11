import { describe, expect, it } from "vitest";

import type { FolioItem } from "@/data/types";
import { collectPaymentFolioToReassign } from "./reassign-payments";

function charge(id: string, amount: number): FolioItem {
  return { id, description: "Charge", amount, timestamp: "2026-07-10T00:00:00Z" };
}

function payment(id: string, amount: number): FolioItem {
  return {
    id,
    description: "Payment - Cash",
    amount: -Math.abs(amount),
    timestamp: "2026-07-10T00:00:00Z",
    paymentMethod: "Cash",
    externalSource: "cash_payment",
  };
}

describe("collectPaymentFolioToReassign", () => {
  it("collects only payments (negative folio), tagged with their source room", () => {
    const removed = [
      { id: "res-1", folio: [charge("c1", 500), payment("p1", 15000)] },
      { id: "res-2", folio: [payment("p2", 2000)] },
    ];

    expect(collectPaymentFolioToReassign(removed)).toEqual([
      { folioItemId: "p1", fromReservationId: "res-1" },
      { folioItemId: "p2", fromReservationId: "res-2" },
    ]);
  });

  it("leaves charges behind", () => {
    const removed = [{ id: "res-1", folio: [charge("c1", 500), charge("c2", 300)] }];
    expect(collectPaymentFolioToReassign(removed)).toEqual([]);
  });

  it("tolerates missing/empty folio", () => {
    const removed = [{ id: "res-1", folio: null }, { id: "res-2" }];
    expect(collectPaymentFolioToReassign(removed)).toEqual([]);
  });

  it("returns nothing when no rooms are removed", () => {
    expect(collectPaymentFolioToReassign([])).toEqual([]);
  });
});

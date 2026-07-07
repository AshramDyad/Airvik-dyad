import { describe, expect, it } from "vitest";

import type { OwnerLedgerEntry } from "@/lib/owner-overview/types";
import { allocatePayouts } from "./allocate";

/** Build a settled credit. `net` is the after-fee amount the allocator draws down. */
function settled(
  id: string,
  settledOn: string,
  net: number,
  reference = id,
): OwnerLedgerEntry {
  return {
    id,
    date: settledOn,
    description: `credit ${id}`,
    reference,
    amount: net,
    feeAmount: 0,
    netAmount: net,
    kind: "credit",
    settledOn,
  };
}

function payout(id: string, date: string, amount: number): OwnerLedgerEntry {
  return {
    id,
    date,
    description: `payout ${id}`,
    reference: id,
    amount,
    feeAmount: 0,
    netAmount: amount,
    kind: "payout",
    settledOn: null,
  };
}

describe("allocatePayouts", () => {
  it("returns empty view for no data", () => {
    const view = allocatePayouts([], []);
    expect(view.payouts).toEqual([]);
    expect(view.summary.totalSettledNet).toBe(0);
    expect(view.summary.totalPaidOut).toBe(0);
    expect(view.summary.outstanding).toBe(0);
    expect(view.summary.pendingLines).toEqual([]);
  });

  it("fills a payout with oldest settled credits, splitting the last one", () => {
    const credits = [
      settled("A1201", "2026-06-05", 22000),
      settled("A1188", "2026-06-06", 31500),
      settled("A1205", "2026-06-08", 28900),
      settled("A1210", "2026-06-09", 11800),
    ];
    // Total settled = 94,200. Payout of 90,000 leaves 10,000 outstanding... but note
    // FIFO fills 22000 + 31500 + 28900 = 82400, then 7600 of A1210 (partial, 4200 left).
    const view = allocatePayouts(credits, [payout("P1", "2026-06-12", 90000)]);

    expect(view.payouts).toHaveLength(1);
    const p = view.payouts[0];
    expect(p.lines.map((l) => l.settledEntryId)).toEqual([
      "A1201",
      "A1188",
      "A1205",
      "A1210",
    ]);
    expect(p.lines[0].isPartial).toBe(false);
    expect(p.lines[3].isPartial).toBe(true);
    expect(p.lines[3].allocatedAmount).toBe(7600);
    expect(p.allocatedTotal).toBe(90000);
    expect(p.unmatchedAmount).toBe(0);

    // 4,200 of A1210 is still pending payout.
    expect(view.summary.pendingLines).toHaveLength(1);
    expect(view.summary.pendingLines[0].settledEntryId).toBe("A1210");
    expect(view.summary.pendingLines[0].allocatedAmount).toBe(4200);
    expect(view.summary.pendingLines[0].isPartial).toBe(true);
    expect(view.summary.totalSettledNet).toBe(94200);
    expect(view.summary.totalPaidOut).toBe(90000);
    expect(view.summary.outstanding).toBe(4200);
  });

  it("carries a split credit's remainder into the next payout", () => {
    const credits = [settled("A1", "2026-06-01", 10000), settled("A2", "2026-06-02", 10000)];
    const view = allocatePayouts(credits, [
      payout("P1", "2026-06-03", 6000),
      payout("P2", "2026-06-04", 9000),
    ]);

    // P1 takes 6000 of A1.
    expect(view.payouts[0].lines).toHaveLength(1);
    expect(view.payouts[0].lines[0].settledEntryId).toBe("A1");
    expect(view.payouts[0].lines[0].allocatedAmount).toBe(6000);

    // P2 takes the remaining 4000 of A1, then 5000 of A2.
    expect(view.payouts[1].lines.map((l) => l.settledEntryId)).toEqual(["A1", "A2"]);
    expect(view.payouts[1].lines[0].allocatedAmount).toBe(4000);
    expect(view.payouts[1].lines[1].allocatedAmount).toBe(5000);

    expect(view.summary.pendingLines[0].settledEntryId).toBe("A2");
    expect(view.summary.pendingLines[0].allocatedAmount).toBe(5000);
    expect(view.summary.outstanding).toBe(5000);
  });

  it("flags unmatched amount when a payout exceeds the settled pool", () => {
    const view = allocatePayouts(
      [settled("A1", "2026-06-01", 5000)],
      [payout("P1", "2026-06-02", 8000)],
    );
    expect(view.payouts[0].allocatedTotal).toBe(5000);
    expect(view.payouts[0].unmatchedAmount).toBe(3000);
    expect(view.summary.pendingLines).toEqual([]);
    expect(view.summary.outstanding).toBe(-3000);
  });

  it("orders payouts and settled credits chronologically regardless of input order", () => {
    const credits = [
      settled("A2", "2026-06-08", 5000),
      settled("A1", "2026-06-01", 5000),
    ];
    const view = allocatePayouts(credits, [payout("P1", "2026-06-10", 5000)]);
    // Oldest credit (A1) is drawn first.
    expect(view.payouts[0].lines[0].settledEntryId).toBe("A1");
  });
});

import type { OwnerLedgerEntry } from "@/lib/owner-overview/types";
import type {
  PayoutAllocationLine,
  PayoutWithAllocations,
  SettlementView,
} from "./types";

// Half a paisa — settled/payout amounts are 2-decimal, so this absorbs rounding dust.
const EPSILON = 0.005;

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Date a credit settled (falls back to its transaction date). */
function settledSortKey(entry: OwnerLedgerEntry): string {
  return entry.settledOn ?? entry.date;
}

/**
 * FIFO allocation of payouts against settled credits.
 *
 * Settled money forms one pool ordered oldest-first. Each payout (in date order) draws
 * from the top of the pool until its amount is filled — so a payout is shown as covering
 * a set of settled bookings, the last of which may be only partly covered (the remainder
 * carries to the next payout). Whatever is left in the pool is "settled but not yet paid
 * out" (the Outstanding figure).
 *
 * This is a deterministic accounting convention, not source-of-truth: the bank payout row
 * never records which bookings it contained. Pure and I/O-free so it is unit-testable.
 * Labels (booking code / receipt number) are filled in later by the server helper.
 */
export function allocatePayouts(
  settled: OwnerLedgerEntry[],
  payouts: OwnerLedgerEntry[],
): SettlementView {
  const pool = [...settled].sort((a, b) => {
    const ka = settledSortKey(a);
    const kb = settledSortKey(b);
    if (ka !== kb) return ka < kb ? -1 : 1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
  const orderedPayouts = [...payouts].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });

  let poolIndex = 0;
  let remainingInEntry = pool.length > 0 ? pool[0].netAmount : 0;

  const makeLine = (
    entry: OwnerLedgerEntry,
    allocatedAmount: number,
    isPartial: boolean,
  ): PayoutAllocationLine => ({
    reference: entry.reference,
    bookingCode: null,
    receiptSlipNo: null,
    settledEntryId: entry.id,
    settledOn: entry.settledOn ?? entry.date,
    settledNet: entry.netAmount,
    allocatedAmount: round2(allocatedAmount),
    isPartial,
  });

  const payoutViews: PayoutWithAllocations[] = [];
  for (const payout of orderedPayouts) {
    let need = payout.amount;
    const lines: PayoutAllocationLine[] = [];

    while (need > EPSILON && poolIndex < pool.length) {
      const entry = pool[poolIndex];
      const take = Math.min(need, remainingInEntry);
      // Partial when this line uses less than the whole credit (the credit is split).
      const isPartial = take + EPSILON < entry.netAmount;
      lines.push(makeLine(entry, take, isPartial));

      need = round2(need - take);
      remainingInEntry = round2(remainingInEntry - take);
      if (remainingInEntry <= EPSILON) {
        poolIndex += 1;
        remainingInEntry = poolIndex < pool.length ? pool[poolIndex].netAmount : 0;
      }
    }

    const allocatedTotal = round2(
      lines.reduce((sum, line) => sum + line.allocatedAmount, 0),
    );
    payoutViews.push({
      id: payout.id,
      date: payout.date,
      description: payout.description,
      amount: round2(payout.amount),
      allocatedTotal,
      unmatchedAmount: round2(Math.max(payout.amount - allocatedTotal, 0)),
      lines,
    });
  }

  // Settled money left in the pool has not been paid out yet.
  const pendingLines: PayoutAllocationLine[] = [];
  if (poolIndex < pool.length && remainingInEntry > EPSILON) {
    const current = pool[poolIndex];
    pendingLines.push(
      makeLine(current, remainingInEntry, remainingInEntry + EPSILON < current.netAmount),
    );
  }
  for (let i = poolIndex + 1; i < pool.length; i += 1) {
    pendingLines.push(makeLine(pool[i], pool[i].netAmount, false));
  }

  const totalSettledNet = round2(
    pool.reduce((sum, entry) => sum + entry.netAmount, 0),
  );
  const totalPaidOut = round2(
    orderedPayouts.reduce((sum, payout) => sum + payout.amount, 0),
  );

  return {
    payouts: payoutViews,
    summary: {
      totalSettledNet,
      totalPaidOut,
      outstanding: round2(totalSettledNet - totalPaidOut),
      pendingLines,
    },
  };
}

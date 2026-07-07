// Typed shapes for the Settlements page. Kept small and explicit (no `any`) so the
// allocator, the API route, and the client all agree on the contract.

/** How a settled credit is identified to the owner: a booking code or a manual receipt. */
export interface SettlementLineLabel {
  /** Bank reference of the settled credit (the key used to resolve the label). */
  reference: string;
  /** Booking code (e.g. "A1201") if the credit was attached to a reservation, else null. */
  bookingCode: string | null;
  /** Manual receipt slip number (shown as MR-xx) if a receipt exists, else null. */
  receiptSlipNo: number | null;
}

/** One settled credit (or a slice of it) drawn down by a payout, or still pending payout. */
export interface PayoutAllocationLine extends SettlementLineLabel {
  /** Stable id of the settled ledger entry this line came from. */
  settledEntryId: string;
  /** The working-day date the credit cleared into "Settled" (yyyy-MM-dd). */
  settledOn: string;
  /** Full net (after-fee) amount of the settled credit. */
  settledNet: number;
  /** Portion of the credit allocated to this payout (or pending). May be < settledNet. */
  allocatedAmount: number;
  /** True when only part of the credit is in this line (the credit is split). */
  isPartial: boolean;
}

/** A payout and the settled bookings/receipts it covered (oldest first). */
export interface PayoutWithAllocations {
  id: string;
  /** Payout date (yyyy-MM-dd). */
  date: string;
  description: string;
  /** Payout amount (always positive). */
  amount: number;
  /** Sum of the allocated lines. */
  allocatedTotal: number;
  /** Payout amount not covered by any settled money (should be ~0 normally). */
  unmatchedAmount: number;
  lines: PayoutAllocationLine[];
}

/** The three headline numbers plus the still-unpaid settled money. */
export interface SettlementSummary {
  /** Net total of all settled credits (money that cleared into the bank). */
  totalSettledNet: number;
  /** Total of all payouts. */
  totalPaidOut: number;
  /** Settled money not yet paid out = totalSettledNet − totalPaidOut. */
  outstanding: number;
  /** Settled credits (or slices) not yet consumed by any payout. */
  pendingLines: PayoutAllocationLine[];
}

export interface SettlementView {
  payouts: PayoutWithAllocations[];
  summary: SettlementSummary;
}

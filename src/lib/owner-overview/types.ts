// Typed shapes for the owner high-level financial view.
// Kept small and explicit (no `any`) so the API route, the compute helpers,
// and the client all agree on the contract.

export type OwnerLedgerKind = "credit" | "payout";

export interface OwnerLedgerEntry {
  /** Stable key (bank transaction id, falls back to the sheet row number). */
  id: string;
  /** Transaction date (ISO yyyy-MM-dd) — when the money actually moved. */
  date: string;
  description: string;
  reference: string;
  /** Always a positive rupee amount (the gross value); `kind` tells the direction. */
  amount: number;
  /** Gateway fee cut from a settled credit. Always 0 for payouts. */
  feeAmount: number;
  /** Amount after the fee (`amount − feeAmount`). For payouts this equals `amount`. */
  netAmount: number;
  kind: OwnerLedgerKind;
  /** For credits: the working-day date this clears into "Settled". Null for payouts. */
  settledOn: string | null;
  /**
   * True when the sheet's marker column (the "hide" column) holds the word "refund" —
   * i.e. this payout is a guest refund, not an owner payout. Only meaningful for payouts;
   * always false for credits.
   */
  isRefund: boolean;
}

export interface OwnerSettledSummary {
  /** Gross total of pay-ins that cleared in the selected range (before the fee). */
  gross: number;
  /** Gateway fee cut from those cleared pay-ins. */
  fee: number;
  /** Net total that landed = gross − fee. */
  net: number;
  /** How many pay-ins cleared in the range. */
  count: number;
}

export interface OwnerOverviewSummary {
  /** Gross total of pay-ins received in the selected range. */
  transactionsTotal: number;
  /** How many pay-ins were received in the range. */
  transactionsCount: number;
  /** What cleared in the selected range, shown net with a gross/fee breakdown. */
  settledSummary: OwnerSettledSummary;
  /** Credits not yet cleared (settles > today) — shown regardless of the date range. */
  settling: OwnerLedgerEntry[];
  /** Credits that cleared within the selected range, recorded net of the gateway fee. */
  settled: OwnerLedgerEntry[];
  /** Payout debits within the selected range. */
  payouts: OwnerLedgerEntry[];
  /** Flat gateway fee rate applied to settled credits (e.g. 1). */
  feePercent: number;
}

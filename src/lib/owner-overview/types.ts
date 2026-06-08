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
  /** Always a positive rupee amount; `kind` tells the direction. */
  amount: number;
  kind: OwnerLedgerKind;
  /** For credits: the working-day date this clears into "Settled". Null for payouts. */
  settledOn: string | null;
}

export interface OwnerFeeTier {
  /** Current gateway fee rate (e.g. 1, 0.7, 0.3). */
  ratePercent: number;
  /** Parked amount needed to reach the next (lower) rate; null if already best. */
  nextThreshold: number | null;
  /** The rate unlocked at `nextThreshold`; null if already best. */
  nextRatePercent: number | null;
}

export interface OwnerDailyPoint {
  /** yyyy-MM-dd */
  date: string;
  credit: number;
  debit: number;
}

export interface OwnerOverviewSummary {
  account: string;
  /** Credits not yet cleared (settles > today) — shown regardless of the date range. */
  settlement: OwnerLedgerEntry[];
  /** Cleared credits + payout debits within the selected range. */
  settled: OwnerLedgerEntry[];
  creditTotal: number;
  debitTotal: number;
  payoutTotal: number;
  /** Money kept in our system over the selected range = creditTotal − payoutTotal. */
  parkedNet: number;
  /** Money kept over a fixed trailing window — drives the (stable) fee tier. */
  maintainedParked: number;
  /** Length of that trailing window in days (e.g. 30). */
  maintainedWindowDays: number;
  /** Lowest bank balance over the range; null when no row carries a balance. */
  minimumBalance: number | null;
  belowFloor: boolean;
  /** Bank's required minimum balance (penalty risk below this). */
  floor: number;
  feeTier: OwnerFeeTier;
  dailyCreditDebit: OwnerDailyPoint[];
}

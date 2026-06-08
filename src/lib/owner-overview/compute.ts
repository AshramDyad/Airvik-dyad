import {
  addBusinessDays,
  endOfDay,
  format,
  isAfter,
  isBefore,
  isValid,
  parseISO,
  startOfDay,
  subDays,
} from "date-fns";

import type { GoogleSheetTransaction } from "@/data/types";
import type {
  OwnerDailyPoint,
  OwnerFeeTier,
  OwnerLedgerEntry,
  OwnerOverviewSummary,
} from "./types";

// ---- Tunable business rules (single source of truth) ----
export const SETTLEMENT_BUSINESS_DAYS = 4;
export const BANK_MIN_FLOOR = 100000; // ₹1,00,000 — bank's required minimum balance
// The fee tier reflects a maintained (kept) amount over a fixed trailing window
// so it reads as a stable benefit level, not something that flips with the
// page's date filter.
export const MAINTAINED_WINDOW_DAYS = 30;
const PAYOUT_PATTERN = /payout/i;

// Fee tiers by parked amount (credits − payouts), ascending by threshold.
// More money kept in our system → a lower gateway fee.
const FEE_TIERS: ReadonlyArray<{ threshold: number; ratePercent: number }> = [
  { threshold: 0, ratePercent: 1 },
  { threshold: 300000, ratePercent: 0.7 },
  { threshold: 600000, ratePercent: 0.3 },
];

export interface OwnerDateRange {
  from: Date;
  to: Date;
}

/** Parse a sheet money cell ("27,945.12", "-174000.00", "") to a number or null. */
function parseMoney(value: string | null | undefined): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  const normalized = value.replace(/,/g, "").trim();
  if (normalized.length === 0) {
    return null;
  }
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Signed transaction amount: prefer the `amount` column, else credit − debit. */
function getSignedAmount(transaction: GoogleSheetTransaction): number | null {
  if (transaction.amount !== null) {
    return transaction.amount;
  }
  const credit = parseMoney(transaction.raw["credit"]);
  if (credit !== null && credit > 0) {
    return credit;
  }
  const debit = parseMoney(transaction.raw["debit"]);
  if (debit !== null && debit > 0) {
    return -debit;
  }
  return null;
}

/** The transaction's date as a valid Date, or null when missing/unparseable. */
function getTransactionDate(transaction: GoogleSheetTransaction): Date | null {
  if (!transaction.date) {
    return null;
  }
  const parsed = parseISO(transaction.date);
  return isValid(parsed) ? parsed : null;
}

function isWithin(date: Date, range: OwnerDateRange): boolean {
  const from = startOfDay(range.from);
  const to = endOfDay(range.to);
  return !isBefore(date, from) && !isAfter(date, to);
}

function isPayout(transaction: GoogleSheetTransaction, signedAmount: number): boolean {
  return signedAmount < 0 && PAYOUT_PATTERN.test(transaction.description ?? "");
}

/** Net money kept (credits − payouts) over a range — used for the fee tier. */
function getParkedNet(
  transactions: GoogleSheetTransaction[],
  range: OwnerDateRange
): number {
  let credit = 0;
  let payout = 0;
  for (const transaction of transactions) {
    const date = getTransactionDate(transaction);
    const signedAmount = getSignedAmount(transaction);
    if (!date || signedAmount === null || signedAmount === 0) {
      continue;
    }
    if (!isWithin(date, range)) {
      continue;
    }
    if (signedAmount > 0) {
      credit += signedAmount;
    } else if (isPayout(transaction, signedAmount)) {
      payout += Math.abs(signedAmount);
    }
  }
  return credit - payout;
}

function getFeeTier(parkedNet: number): OwnerFeeTier {
  let currentIndex = 0;
  for (let index = 0; index < FEE_TIERS.length; index += 1) {
    if (parkedNet >= FEE_TIERS[index].threshold) {
      currentIndex = index;
    }
  }
  const current = FEE_TIERS[currentIndex];
  const next = FEE_TIERS[currentIndex + 1] ?? null;
  return {
    ratePercent: current.ratePercent,
    nextThreshold: next ? next.threshold : null,
    nextRatePercent: next ? next.ratePercent : null,
  };
}

function toLedgerEntry(
  transaction: GoogleSheetTransaction,
  date: Date,
  signedAmount: number,
  kind: OwnerLedgerEntry["kind"],
  settledOn: Date | null
): OwnerLedgerEntry {
  const id = transaction.raw["transaction_id"]?.trim() || `row-${transaction.rowNumber}`;
  return {
    id,
    date: format(date, "yyyy-MM-dd"),
    description: transaction.description ?? "",
    reference: transaction.reference ?? "",
    amount: Math.abs(signedAmount),
    kind,
    settledOn: settledOn ? format(settledOn, "yyyy-MM-dd") : null,
  };
}

function sortByDateDesc(entries: OwnerLedgerEntry[]): OwnerLedgerEntry[] {
  return [...entries].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

/**
 * Build the owner overview summary from raw sheet rows.
 *
 * - `range` filters the Settled ledger, totals, daily chart and min-balance by txn date.
 * - The Settlement (pending) list ignores the range: it always reflects credits that
 *   have not yet cleared as of `today`.
 */
export function computeOwnerOverview(
  transactions: GoogleSheetTransaction[],
  range: OwnerDateRange,
  today: Date
): OwnerOverviewSummary {
  const todayStart = startOfDay(today);

  const settlement: OwnerLedgerEntry[] = [];
  const settled: OwnerLedgerEntry[] = [];
  const dailyMap = new Map<string, OwnerDailyPoint>();

  let creditTotal = 0;
  let debitTotal = 0;
  let payoutTotal = 0;
  let minimumBalance: number | null = null;
  let account = "";

  for (const transaction of transactions) {
    if (!account) {
      account = transaction.raw["account"]?.trim() ?? "";
    }

    const date = getTransactionDate(transaction);
    const signedAmount = getSignedAmount(transaction);
    if (!date || signedAmount === null || signedAmount === 0) {
      continue;
    }

    const isCredit = signedAmount > 0;
    const payout = isPayout(transaction, signedAmount);
    const settledOn = isCredit
      ? addBusinessDays(date, SETTLEMENT_BUSINESS_DAYS)
      : null;

    // Settlement (pending) — global, not range filtered.
    if (isCredit && settledOn && isAfter(startOfDay(settledOn), todayStart)) {
      settlement.push(toLedgerEntry(transaction, date, signedAmount, "credit", settledOn));
    }

    if (!isWithin(date, range)) {
      continue;
    }

    // Range-scoped aggregates below.
    const dayKey = format(date, "yyyy-MM-dd");
    const point = dailyMap.get(dayKey) ?? { date: dayKey, credit: 0, debit: 0 };

    if (isCredit) {
      creditTotal += signedAmount;
      point.credit += signedAmount;
      // A credit lands in "Settled" once it has cleared.
      if (settledOn && !isAfter(startOfDay(settledOn), todayStart)) {
        settled.push(toLedgerEntry(transaction, date, signedAmount, "credit", settledOn));
      }
    } else {
      const magnitude = Math.abs(signedAmount);
      debitTotal += magnitude;
      point.debit += magnitude;
      if (payout) {
        payoutTotal += magnitude;
        settled.push(toLedgerEntry(transaction, date, signedAmount, "payout", null));
      }
    }

    dailyMap.set(dayKey, point);

    const balance = parseMoney(transaction.raw["balance"]);
    if (balance !== null) {
      minimumBalance = minimumBalance === null ? balance : Math.min(minimumBalance, balance);
    }
  }

  const parkedNet = creditTotal - payoutTotal;
  const dailyCreditDebit = Array.from(dailyMap.values()).sort((a, b) =>
    a.date < b.date ? -1 : a.date > b.date ? 1 : 0
  );

  // Fee tier is based on a fixed trailing window, not the selected range, so it
  // stays a stable benefit level regardless of which dates the owner views.
  const maintainedRange: OwnerDateRange = {
    from: subDays(startOfDay(today), MAINTAINED_WINDOW_DAYS - 1),
    to: today,
  };
  const maintainedParked = getParkedNet(transactions, maintainedRange);

  return {
    account,
    settlement: sortByDateDesc(settlement),
    settled: sortByDateDesc(settled),
    creditTotal,
    debitTotal,
    payoutTotal,
    parkedNet,
    maintainedParked,
    maintainedWindowDays: MAINTAINED_WINDOW_DAYS,
    minimumBalance,
    belowFloor: minimumBalance !== null && minimumBalance < BANK_MIN_FLOOR,
    floor: BANK_MIN_FLOOR,
    feeTier: getFeeTier(maintainedParked),
    dailyCreditDebit,
  };
}

import { addBusinessDays, format, parseISO, startOfDay } from "date-fns";

import type { GoogleSheetTransaction } from "@/data/types";
import type {
  OwnerLedgerEntry,
  OwnerOverviewSummary,
  OwnerSettledSummary,
} from "./types";

// ---- Tunable business rules (single source of truth) ----
export const SETTLEMENT_BUSINESS_DAYS = 7;
// Flat gateway fee cut from every settled credit. The owner sees the gross amount
// while it is still settling and the after-fee amount once it has cleared.
export const SETTLEMENT_FEE_PERCENT = 1;
// Bank statement days and "today" are read on the property's clock.
export const DEFAULT_TIME_ZONE = "Asia/Kolkata";
const PAYOUT_PATTERN = /payout/i;
// A payout tagged with the single word "refund" in the sheet's marker column (the same
// last column used for "hide") is a guest refund, not an owner payout. We scan the whole
// row for a cell that is exactly that word: "hide"/"refund" never appear as a full cell
// anywhere else, and Google omits trailing empty cells so a fixed index is unreliable.
const REFUND_MARKER = "refund";

export interface OwnerDateRange {
  from: Date;
  to: Date;
}

/** Round a rupee value to paise (2 decimal places). */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Split a gross credit into the gateway fee and the amount that lands as settled. */
function applyFee(gross: number): { fee: number; net: number } {
  const fee = round2((gross * SETTLEMENT_FEE_PERCENT) / 100);
  return { fee, net: round2(gross - fee) };
}

function pad2(value: number): string {
  return value < 10 ? `0${value}` : `${value}`;
}

/**
 * A bank statement date is a calendar *day*, not an instant — so `DD/MM/YYYY`,
 * `DD-MM-YYYY`, `DD.MM.YYYY` and compact `DDMMYYYY` are read straight into a
 * `yyyy-MM-dd` key with no timezone shift (mirrors the Payments page parser). Only a
 * real timestamp falls back to a timezone-aware conversion.
 */
function getSheetDateKey(value: string | null, timeZone: string): string | null {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  const separated = trimmed.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4}|\d{2})/);
  if (separated) {
    const first = Number.parseInt(separated[1], 10);
    const second = Number.parseInt(separated[2], 10);
    const yearPart = Number.parseInt(separated[3], 10);
    const year = yearPart < 100 ? 2000 + yearPart : yearPart;
    // Day/month disambiguation: whichever side is > 12 must be the day.
    const day = first > 12 ? first : second > 12 ? second : first;
    const month = first > 12 ? second : second > 12 ? first : second;
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${pad2(month)}-${pad2(day)}`;
    }
  }

  const compact = trimmed.match(/^(\d{2})(\d{2})(\d{2}|\d{4})$/);
  if (compact) {
    const day = Number.parseInt(compact[1], 10);
    const month = Number.parseInt(compact[2], 10);
    const yearPart = Number.parseInt(compact[3], 10);
    const year = yearPart < 100 ? 2000 + yearPart : yearPart;
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${pad2(month)}-${pad2(day)}`;
    }
  }

  const timestamp = Date.parse(trimmed);
  if (Number.isFinite(timestamp)) {
    return getDateKeyForInstant(new Date(timestamp), timeZone);
  }
  return null;
}

/** The `yyyy-MM-dd` calendar day of an instant, read in the given timezone. */
function getDateKeyForInstant(date: Date, timeZone: string): string | null {
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);
    const year = parts.find((part) => part.type === "year")?.value;
    const month = parts.find((part) => part.type === "month")?.value;
    const day = parts.find((part) => part.type === "day")?.value;
    if (!year || !month || !day) {
      return null;
    }
    return `${year}-${month}-${day}`;
  } catch {
    return null;
  }
}

/**
 * Add working days to a `yyyy-MM-dd` key and return a `yyyy-MM-dd` key. The round-trip
 * through `parseISO` (local midnight) and `format` cancels the local timezone, so the
 * calendar arithmetic is timezone-independent.
 */
function addBusinessDaysKey(dayKey: string, days: number): string {
  return format(addBusinessDays(parseISO(dayKey), days), "yyyy-MM-dd");
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

function isPayout(transaction: GoogleSheetTransaction, signedAmount: number): boolean {
  return signedAmount < 0 && PAYOUT_PATTERN.test(transaction.description ?? "");
}

/** True when any cell in the row is exactly the word "refund" (case-insensitive). */
function isRefundTagged(transaction: GoogleSheetTransaction): boolean {
  return transaction.cells.some((cell) => cell.trim().toLowerCase() === REFUND_MARKER);
}

function toLedgerEntry(
  transaction: GoogleSheetTransaction,
  dateKey: string,
  amount: number,
  feeAmount: number,
  kind: OwnerLedgerEntry["kind"],
  settledOn: string | null
): OwnerLedgerEntry {
  const id = transaction.raw["transaction_id"]?.trim() || `row-${transaction.rowNumber}`;
  return {
    id,
    date: dateKey,
    description: transaction.description ?? "",
    reference: transaction.reference ?? "",
    amount,
    feeAmount,
    netAmount: round2(amount - feeAmount),
    kind,
    settledOn,
    isRefund: isRefundTagged(transaction),
  };
}

function sortByDateDesc(entries: OwnerLedgerEntry[]): OwnerLedgerEntry[] {
  return [...entries].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

/** Newest settlement on top — what the owner reads as "the latest money to land". */
function sortBySettledOnDesc(entries: OwnerLedgerEntry[]): OwnerLedgerEntry[] {
  return [...entries].sort((a, b) => {
    const left = a.settledOn ?? a.date;
    const right = b.settledOn ?? b.date;
    return left < right ? 1 : left > right ? -1 : 0;
  });
}

/**
 * Build the owner overview summary from raw sheet rows.
 *
 * - The two cards (transactions, settled) follow the selected `range`: transactions received
 *   in range and credits that cleared in range.
 * - `range` also filters the Settled ledger (by settle date) and the Payout ledger (by txn date).
 * - The Settling (pending) list ignores the range: it always reflects credits that have not
 *   yet cleared as of `today`.
 */
export function computeOwnerOverview(
  transactions: GoogleSheetTransaction[],
  range: OwnerDateRange,
  today: Date
): OwnerOverviewSummary {
  const timeZone = DEFAULT_TIME_ZONE;
  const todayKey =
    getDateKeyForInstant(today, timeZone) ?? format(startOfDay(today), "yyyy-MM-dd");
  const fromKey = format(startOfDay(range.from), "yyyy-MM-dd");
  const toKey = format(startOfDay(range.to), "yyyy-MM-dd");

  const settling: OwnerLedgerEntry[] = [];
  const settled: OwnerLedgerEntry[] = [];
  const payouts: OwnerLedgerEntry[] = [];

  let transactionsTotal = 0;
  let transactionsCount = 0;
  let settledGross = 0;
  let settledFee = 0;
  let settledNet = 0;
  let settledCount = 0;

  for (const transaction of transactions) {
    const txnKey = getSheetDateKey(transaction.date ?? transaction.fetchedAt, timeZone);
    const signedAmount = getSignedAmount(transaction);
    if (!txnKey || signedAmount === null || signedAmount === 0) {
      continue;
    }

    if (signedAmount > 0) {
      const settledKey = addBusinessDaysKey(txnKey, SETTLEMENT_BUSINESS_DAYS);
      const hasCleared = settledKey <= todayKey;

      // Card: pay-ins received in the selected range.
      if (txnKey >= fromKey && txnKey <= toKey) {
        transactionsTotal += signedAmount;
        transactionsCount += 1;
      }

      if (!hasCleared) {
        // Settling — global (not range filtered), shown gross.
        settling.push(toLedgerEntry(transaction, txnKey, signedAmount, 0, "credit", settledKey));
        continue;
      }

      const { fee, net } = applyFee(signedAmount);

      // Settled card + tab — keyed off the settle date, range filtered.
      if (settledKey >= fromKey && settledKey <= toKey) {
        settledGross += signedAmount;
        settledFee += fee;
        settledNet += net;
        settledCount += 1;
        settled.push(toLedgerEntry(transaction, txnKey, signedAmount, fee, "credit", settledKey));
      }
    } else if (isPayout(transaction, signedAmount)) {
      const magnitude = Math.abs(signedAmount);
      if (txnKey >= fromKey && txnKey <= toKey) {
        payouts.push(toLedgerEntry(transaction, txnKey, magnitude, 0, "payout", null));
      }
    }
  }

  const settledSummary: OwnerSettledSummary = {
    gross: round2(settledGross),
    fee: round2(settledFee),
    net: round2(settledNet),
    count: settledCount,
  };

  return {
    transactionsTotal: round2(transactionsTotal),
    transactionsCount,
    settledSummary,
    settling: sortByDateDesc(settling),
    settled: sortBySettledOnDesc(settled),
    payouts: sortByDateDesc(payouts),
    feePercent: SETTLEMENT_FEE_PERCENT,
  };
}

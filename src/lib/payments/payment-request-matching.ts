import type { GoogleSheetTransaction } from "@/data/types";

export const PAYMENT_REQUEST_EXPIRY_HOURS = 3;
export const PAYMENT_UPI_ID = "biz.sahajana959@fbl";
export const PAYMENT_MERCHANT_NAME = "Sahajanand Wellness";
export const PAYMENT_IDENTIFIER_LENGTH = 5;

const CREDITED_STATUS_PATTERN =
  /\b(credit|credited|success|successful|paid|received|complete|completed|captured|settled)\b/i;
const EXCLUDED_STATUS_PATTERN =
  /\b(cancel|cancelled|canceled|chargeback|debit|debited|declined|fail|failed|failure|pending|refund|refunded|reversal|reversed|unpaid|void|withdrawn)\b/i;

export type PendingPaymentRequestMatch = {
  id: string;
  identifier: string;
  amount: number;
  expiresAt: string;
};

export type MatchedPaymentTransaction = {
  request: PendingPaymentRequestMatch;
  transaction: GoogleSheetTransaction;
};

export function buildUpiPaymentUri(args: {
  identifier: string;
  amount: number;
  upiId?: string;
  merchantName?: string;
}): string {
  const upiId = args.upiId ?? PAYMENT_UPI_ID;
  const merchantName = args.merchantName ?? PAYMENT_MERCHANT_NAME;
  const amount = formatUpiAmount(args.amount);
  const note = `Payment ${args.identifier}`;
  const params = new URLSearchParams({
    pa: upiId,
    pn: merchantName,
    am: amount,
    cu: "INR",
    tr: args.identifier,
    tn: note,
  });

  return `upi://pay?${params.toString()}`;
}

export function findPaymentRequestMatches(
  requests: PendingPaymentRequestMatch[],
  transactions: GoogleSheetTransaction[],
  now: Date = new Date()
): MatchedPaymentTransaction[] {
  const usedRowNumbers = new Set<number>();
  const matches: MatchedPaymentTransaction[] = [];

  for (const request of requests) {
    if (isExpired(request.expiresAt, now)) {
      continue;
    }

    const transaction = transactions.find((row) => {
      if (usedRowNumbers.has(row.rowNumber)) {
        return false;
      }

      return doesTransactionMatchRequest(row, request);
    });

    if (transaction) {
      usedRowNumbers.add(transaction.rowNumber);
      matches.push({ request, transaction });
    }
  }

  return matches;
}

export function doesTransactionMatchRequest(
  transaction: GoogleSheetTransaction,
  request: Pick<PendingPaymentRequestMatch, "identifier" | "amount">
): boolean {
  if (!isCreditedSheetTransaction(transaction)) {
    return false;
  }

  if (!isSameMoneyAmount(transaction.amount, request.amount)) {
    return false;
  }

  return getTransactionMatchText(transaction).includes(request.identifier.toUpperCase());
}

export function isCreditedSheetTransaction(row: GoogleSheetTransaction): boolean {
  if (row.amount === null || row.amount <= 0) {
    return false;
  }

  const status = row.status?.trim() ?? "";
  if (status) {
    if (EXCLUDED_STATUS_PATTERN.test(status)) {
      return false;
    }

    return CREDITED_STATUS_PATTERN.test(status);
  }

  return isCreditRow(row);
}

export function formatUpiAmount(amount: number): string {
  return amount.toFixed(2);
}

function isExpired(expiresAt: string, now: Date): boolean {
  const expiry = new Date(expiresAt);
  if (Number.isNaN(expiry.getTime())) {
    return true;
  }

  return expiry.getTime() <= now.getTime();
}

function isSameMoneyAmount(left: number | null, right: number): boolean {
  if (left === null) {
    return false;
  }

  return Math.round(left * 100) === Math.round(right * 100);
}

function isCreditRow(row: GoogleSheetTransaction): boolean {
  const credit = getRawAmountByHeader(row, "credit");
  if (credit !== null) {
    return credit > 0;
  }

  const debit = getRawAmountByHeader(row, "debit");
  if (debit !== null && debit > 0) {
    return false;
  }

  return row.amount !== null && row.amount > 0;
}

function getRawAmountByHeader(
  row: GoogleSheetTransaction,
  header: string
): number | null {
  const entry = Object.entries(row.raw).find(
    ([key, value]) =>
      normalizeLabel(key) === header && value.trim().length > 0
  );
  if (!entry) {
    return null;
  }

  return parseSheetAmount(entry[1]);
}

function parseSheetAmount(value: string): number | null {
  const normalized = value.replace(/,/g, "");
  const match = normalized.match(/-?\d+(?:\.\d+)?/);
  if (!match) {
    return null;
  }

  const parsed = Number.parseFloat(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

function getTransactionMatchText(row: GoogleSheetTransaction): string {
  return [
    row.date,
    row.fetchedAt,
    row.description,
    row.payer,
    row.amountText,
    row.method,
    row.reference,
    row.status,
    ...row.cells,
    ...Object.values(row.raw),
  ]
    .filter((value): value is string => typeof value === "string")
    .join(" ")
    .toUpperCase();
}

function normalizeLabel(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

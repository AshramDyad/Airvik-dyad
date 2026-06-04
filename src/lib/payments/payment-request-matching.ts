import type { GoogleSheetTransaction } from "@/data/types";

export const PAYMENT_REQUEST_EXPIRY_HOURS = 3;
export const PAYMENT_UPI_ID = "biz.sahajana959@fbl";
export const PAYMENT_MERCHANT_NAME = "Sahajanand Wellness";
export const PAYMENT_IDENTIFIER_LENGTH = 5;
export const PAYMENT_IDENTIFIER_PREFIX = "SW";
export const PAYMENT_STATEMENT_CODE_LENGTH = 4;
export const PAYMENT_AMOUNT_SUFFIX_PAISE = [
  1,
  2,
  3,
  4,
  5,
  6,
  7,
  8,
  9,
] as const;

const CREDITED_STATUS_PATTERN =
  /\b(credit|credited|success|successful|paid|received|complete|completed|captured|settled)\b/i;
const EXCLUDED_STATUS_PATTERN =
  /\b(cancel|cancelled|canceled|chargeback|debit|debited|declined|fail|failed|failure|pending|refund|refunded|reversal|reversed|unpaid|void|withdrawn)\b/i;

export type PendingPaymentRequestMatch = {
  id: string;
  identifier: string;
  statementCode: string | null;
  amount: number;
  requestedAt: string;
  expiresAt: string;
};

export type MatchedPaymentTransaction = {
  request: PendingPaymentRequestMatch;
  transaction: GoogleSheetTransaction;
};

export type PaymentRequestMatchOptions = {
  now?: Date;
  usedPaymentReferences?: ReadonlySet<string>;
};

export function buildUpiPaymentUri(args: {
  identifier: string;
  statementCode?: string | null;
  amount: number;
  upiId?: string;
  merchantName?: string;
}): string {
  const upiId = args.upiId ?? PAYMENT_UPI_ID;
  const merchantName = args.merchantName ?? PAYMENT_MERCHANT_NAME;
  const amount = formatUpiAmount(args.amount);
  const statementCode = normalizeStatementCode(args.statementCode);
  const reference = statementCode ?? getPaymentRequestCode(args.identifier);
  const note = statementCode ?? getPaymentRequestNote(args.identifier, merchantName);
  const params = new URLSearchParams({
    pa: upiId,
    pn: merchantName,
    am: amount,
    cu: "INR",
    tn: note,
    tr: reference,
  });

  return `upi://pay?${params.toString()}`;
}

export function getPaymentRequestCode(identifier: string): string {
  return `${PAYMENT_IDENTIFIER_PREFIX}-${identifier.toUpperCase()}`;
}

export function getPaymentRequestNote(
  identifier: string,
  merchantName = PAYMENT_MERCHANT_NAME
): string {
  return `${getPaymentRequestCode(identifier)} ${merchantName}`;
}

export function getPaymentRequestDisplayCode(request: {
  identifier: string;
  statementCode?: string | null;
  upiUri?: string | null;
}): string {
  return (
    normalizeStatementCode(request.statementCode) ??
    getStatementCodeFromUpiUri(request.upiUri) ??
    getPaymentRequestCode(request.identifier)
  );
}

export function getStatementCodeFromUpiUri(
  upiUri: string | null | undefined
): string | null {
  const query = upiUri?.split("?")[1];
  if (!query) {
    return null;
  }

  const params = new URLSearchParams(query);
  return (
    normalizeStatementCode(params.get("tn")) ??
    normalizeStatementCode(params.get("tr"))
  );
}

export function findPaymentRequestMatches(
  requests: PendingPaymentRequestMatch[],
  transactions: GoogleSheetTransaction[],
  options: Date | PaymentRequestMatchOptions = new Date()
): MatchedPaymentTransaction[] {
  const matchOptions =
    options instanceof Date ? { now: options } : options;
  const now = matchOptions.now ?? new Date();
  const usedPaymentReferences =
    matchOptions.usedPaymentReferences ?? new Set<string>();
  const activeRequests = requests.filter(
    (request) => !isExpired(request.expiresAt, now)
  );
  const usedRowNumbers = new Set<number>();
  const matchedRequestIds = new Set<string>();
  const matches: MatchedPaymentTransaction[] = [];

  for (const request of activeRequests) {
    const statementCode = normalizeStatementCode(request.statementCode);
    if (!statementCode) {
      continue;
    }

    const transaction = transactions.find((row) => {
      if (usedRowNumbers.has(row.rowNumber)) {
        return false;
      }

      return (
        isFreshPaymentTransaction(row, request) &&
        isUnusedPaymentReference(row, usedPaymentReferences) &&
        isCreditedSheetTransaction(row) &&
        isSameMoneyAmount(row.amount, request.amount) &&
        hasStatementCodeToken(getTransactionMatchText(row), statementCode)
      );
    });

    if (transaction) {
      usedRowNumbers.add(transaction.rowNumber);
      matchedRequestIds.add(request.id);
      matches.push({ request, transaction });
    }
  }

  for (const request of activeRequests) {
    if (matchedRequestIds.has(request.id) || request.statementCode) {
      continue;
    }

    const transaction = transactions.find((row) => {
      if (usedRowNumbers.has(row.rowNumber)) {
        return false;
      }

      return (
        isFreshPaymentTransaction(row, request) &&
        isUnusedPaymentReference(row, usedPaymentReferences) &&
        doesLegacyTransactionMatchRequest(row, request)
      );
    });

    if (transaction) {
      usedRowNumbers.add(transaction.rowNumber);
      matchedRequestIds.add(request.id);
      matches.push({ request, transaction });
    }
  }

  // Pass 3: dynamic-decimal OR truncated identifier (high-confidence fuzzy fallback).
  // Banks render the UPI note in a fixed-width "particulars" field, so the 4-letter
  // statement code is often truncated (e.g. "ACNO" arrives as "AC"). Confirm a credited,
  // fresh, not-yet-used row when it points to exactly one waiting request either by its
  // exact unique decimal amount, or by the whole-rupee amount plus at least the first two
  // letters of its code. A decimal-only match is held back if a *different* full code is
  // shown (likely another booking's payment).
  for (const row of transactions) {
    if (
      usedRowNumbers.has(row.rowNumber) ||
      row.amount === null ||
      !isCreditedSheetTransaction(row) ||
      !isUnusedPaymentReference(row, usedPaymentReferences)
    ) {
      continue;
    }

    const note = (row.description ?? "").toUpperCase();
    const candidates = activeRequests.filter((request) => {
      if (matchedRequestIds.has(request.id)) {
        return false;
      }

      const statementCode = normalizeStatementCode(request.statementCode);
      if (!statementCode || !isFreshPaymentTransaction(row, request)) {
        return false;
      }

      const decimalMatch =
        hasDynamicDecimal(request.amount) &&
        isSameMoneyAmount(row.amount, request.amount);
      const identifierMatch =
        isSameWholeRupeeAmount(row.amount, request.amount) &&
        hasStatementCodePrefixToken(note, statementCode, 2);

      return decimalMatch || identifierMatch;
    });

    if (candidates.length !== 1) {
      continue;
    }

    const request = candidates[0];
    const statementCode = normalizeStatementCode(request.statementCode);
    if (!statementCode) {
      continue;
    }

    const identifierMatch = hasStatementCodePrefixToken(note, statementCode, 2);
    const decimalMatch =
      hasDynamicDecimal(request.amount) &&
      isSameMoneyAmount(row.amount, request.amount);
    const confirmed =
      identifierMatch ||
      (decimalMatch && !hasForeignFullCode(note, statementCode));

    if (!confirmed) {
      continue;
    }

    usedRowNumbers.add(row.rowNumber);
    matchedRequestIds.add(request.id);
    matches.push({ request, transaction: row });
  }

  return matches;
}

export function doesTransactionMatchRequest(
  transaction: GoogleSheetTransaction,
  request: Pick<
    PendingPaymentRequestMatch,
    "identifier" | "statementCode" | "amount"
  >
): boolean {
  if (!isCreditedSheetTransaction(transaction)) {
    return false;
  }

  if (!isSameMoneyAmount(transaction.amount, request.amount)) {
    return false;
  }

  const matchText = getTransactionMatchText(transaction);
  const statementCode = normalizeStatementCode(request.statementCode);
  if (statementCode) {
    return hasStatementCodeToken(matchText, statementCode);
  }

  return doesLegacyMatchTextContainIdentifier(matchText, request.identifier);
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

export function getPaymentRequestAmountWithSuffix(
  amount: number,
  suffixPaise: number
): number {
  if (
    !Number.isInteger(suffixPaise) ||
    suffixPaise < PAYMENT_AMOUNT_SUFFIX_PAISE[0] ||
    suffixPaise >
      PAYMENT_AMOUNT_SUFFIX_PAISE[PAYMENT_AMOUNT_SUFFIX_PAISE.length - 1]
  ) {
    throw new Error("Payment amount suffix must be between 1 and 9 paise.");
  }

  return fromPaise(toPaise(amount) + suffixPaise);
}

export function pickAvailablePaymentRequestAmount(args: {
  amount: number;
  activeAmounts: readonly number[];
  suffixes?: readonly number[];
}): number {
  const activeAmountPaise = new Set(args.activeAmounts.map(toPaise));
  const suffixes = args.suffixes ?? PAYMENT_AMOUNT_SUFFIX_PAISE;

  for (const suffixPaise of suffixes) {
    const candidate = getPaymentRequestAmountWithSuffix(
      args.amount,
      suffixPaise
    );

    if (!activeAmountPaise.has(toPaise(candidate))) {
      return candidate;
    }
  }

  throw new Error(
    "Unable to create a unique payment amount because all paise suffixes are already in use. Refresh or clear old pending payment requests and try again."
  );
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

  return toPaise(left) === toPaise(right);
}

function doesLegacyTransactionMatchRequest(
  transaction: GoogleSheetTransaction,
  request: Pick<PendingPaymentRequestMatch, "identifier" | "amount">
): boolean {
  if (!isCreditedSheetTransaction(transaction)) {
    return false;
  }

  if (!isSameMoneyAmount(transaction.amount, request.amount)) {
    return false;
  }

  return doesLegacyMatchTextContainIdentifier(
    getTransactionMatchText(transaction),
    request.identifier
  );
}

function doesLegacyMatchTextContainIdentifier(
  matchText: string,
  identifier: string
): boolean {
  const rawIdentifier = identifier.toUpperCase();
  const paymentCode = getPaymentRequestCode(identifier).toUpperCase();

  return matchText.includes(paymentCode) || matchText.includes(rawIdentifier);
}

function hasStatementCodeToken(matchText: string, code: string): boolean {
  const normalizedCode = code.toUpperCase();
  const pattern = new RegExp(
    `(^|[^A-Z0-9])${escapeRegExp(normalizedCode)}([^A-Z0-9]|$)`
  );
  return pattern.test(matchText);
}

// True when the statement text contains at least the first `minLen` letters of the code
// as a clean token. Tries the longest prefix first so a fully-surviving code still wins.
function hasStatementCodePrefixToken(
  matchText: string,
  code: string,
  minLen: number
): boolean {
  const normalizedCode = code.toUpperCase();
  for (let length = normalizedCode.length; length >= minLen; length -= 1) {
    if (hasStatementCodeToken(matchText, normalizedCode.slice(0, length))) {
      return true;
    }
  }

  return false;
}

// True when the text contains a clean 4-letter (statement-code length) token that is NOT
// this request's code — i.e. a different booking's full code is shown. Used to hold back a
// decimal-only match that is contradicted by another visible code.
function hasForeignFullCode(matchText: string, code: string): boolean {
  const normalizedCode = code.toUpperCase();
  const tokens = matchText.toUpperCase().match(/[A-Z]+/g);
  if (!tokens) {
    return false;
  }

  return tokens.some(
    (token) =>
      token.length === PAYMENT_STATEMENT_CODE_LENGTH && token !== normalizedCode
  );
}

// True when the amount carries a real 1-9 paise dynamic-decimal suffix (not a round .x0).
function hasDynamicDecimal(amount: number): boolean {
  return toPaise(amount) % 10 !== 0;
}

// True when both amounts share the same whole-rupee value, ignoring the paise suffix.
function isSameWholeRupeeAmount(left: number | null, right: number): boolean {
  if (left === null) {
    return false;
  }

  return Math.floor(toPaise(left) / 100) === Math.floor(toPaise(right) / 100);
}

function normalizeStatementCode(
  statementCode: string | null | undefined
): string | null {
  if (!statementCode) {
    return null;
  }

  const normalized = statementCode.trim().toUpperCase();
  return /^[A-Z]{4}$/.test(normalized) ? normalized : null;
}

function isFreshPaymentTransaction(
  transaction: GoogleSheetTransaction,
  request: PendingPaymentRequestMatch
): boolean {
  const requestedAt = Date.parse(request.requestedAt);
  if (!Number.isFinite(requestedAt)) {
    return false;
  }

  const fetchedAt = parseSheetDateTime(transaction.fetchedAt);
  if (fetchedAt !== null && fetchedAt < requestedAt) {
    return false;
  }

  const transactionAt = parseSheetDateTime(transaction.date);
  if (transactionAt !== null && transactionAt < requestedAt) {
    return false;
  }

  return true;
}

function parseSheetDateTime(value: string | null): number | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!hasTimeComponent(trimmed)) {
    return null;
  }

  const parsed = Date.parse(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function hasTimeComponent(value: string): boolean {
  return /T\d{2}:\d{2}/.test(value) || /\b\d{1,2}:\d{2}(?::\d{2})?\b/.test(value);
}

function isUnusedPaymentReference(
  transaction: GoogleSheetTransaction,
  usedPaymentReferences: ReadonlySet<string>
): boolean {
  const reference = normalizePaymentReference(transaction.reference);
  return reference === null || !usedPaymentReferences.has(reference);
}

export function normalizePaymentReference(
  reference: string | null | undefined
): string | null {
  const normalized = reference?.trim().toUpperCase();
  return normalized ? normalized : null;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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

function toPaise(amount: number): number {
  return Math.round(amount * 100);
}

function fromPaise(amountPaise: number): number {
  return amountPaise / 100;
}

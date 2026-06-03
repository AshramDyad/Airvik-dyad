import "server-only";

import { randomInt } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  GoogleSheetTransaction,
  PaymentRequest,
  PaymentRequestStatus,
} from "@/data/types";
import { fetchGoogleSheetTransactions } from "@/lib/google-sheets/transactions";
import {
  buildUpiPaymentUri,
  findPaymentRequestMatches,
  getStatementCodeFromUpiUri,
  normalizePaymentReference,
  PAYMENT_AMOUNT_SUFFIX_PAISE,
  PAYMENT_IDENTIFIER_LENGTH,
  PAYMENT_IDENTIFIER_PREFIX,
  PAYMENT_MERCHANT_NAME,
  PAYMENT_REQUEST_EXPIRY_HOURS,
  PAYMENT_STATEMENT_CODE_LENGTH,
  PAYMENT_UPI_ID,
  pickAvailablePaymentRequestAmount,
  type PendingPaymentRequestMatch,
} from "@/lib/payments/payment-request-matching";

const IDENTIFIER_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const STATEMENT_CODE_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const MANUAL_ADMIN_CONFIRM_REFERENCE = "manual-admin-confirm";
const PAYMENT_REQUEST_SELECT = [
  "id",
  "identifier",
  "statement_code",
  "reservation_id",
  "folio_item_id",
  "amount",
  "paid_amount",
  "status",
  "upi_id",
  "upi_merchant_name",
  "upi_uri",
  "requested_at",
  "expires_at",
  "paid_at",
  "payment_reference",
  "matched_transaction",
  "notes",
  "created_by",
  "created_at",
  "updated_at",
].join(", ");

type DbPaymentRequest = {
  id: string;
  identifier: string;
  statement_code: string | null;
  reservation_id: string | null;
  folio_item_id: string | null;
  amount: number | string;
  paid_amount: number | string;
  status: string;
  upi_id: string;
  upi_merchant_name: string;
  upi_uri: string;
  requested_at: string;
  expires_at: string;
  paid_at: string | null;
  payment_reference: string | null;
  matched_transaction: GoogleSheetTransaction | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

type PaymentRequestInsert = {
  identifier: string;
  statement_code: string;
  reservation_id?: string | null;
  amount: number;
  upi_id: string;
  upi_merchant_name: string;
  upi_uri: string;
  expires_at: string;
  created_by: string;
};

export async function listPaymentRequests(
  supabase: SupabaseClient,
  options: { reservationId?: string | null } = {}
): Promise<PaymentRequest[]> {
  await markExpiredPaymentRequests(supabase, options);

  let query = supabase
    .from("payment_requests")
    .select(PAYMENT_REQUEST_SELECT)
    .order("created_at", { ascending: false });

  if (options.reservationId) {
    query = query.eq("reservation_id", options.reservationId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as unknown as DbPaymentRequest[]).map(toPaymentRequest);
}

export async function createPaymentRequest(args: {
  supabase: SupabaseClient;
  amount: number;
  createdBy: string;
  reservationId?: string | null;
}): Promise<PaymentRequest> {
  const { supabase, amount, createdBy, reservationId } = args;
  await markExpiredPaymentRequests(supabase);
  const identifier = await createUniqueIdentifier(supabase);
  const paymentAmount = await createUniquePaymentAmount(supabase, amount);
  const statementCode = await createUniqueStatementCode(supabase, paymentAmount);
  const upiUri = buildUpiPaymentUri({
    identifier,
    statementCode,
    amount: paymentAmount,
  });
  const expiresAt = new Date(
    Date.now() + PAYMENT_REQUEST_EXPIRY_HOURS * 60 * 60 * 1000
  ).toISOString();

  const payload: PaymentRequestInsert = {
    identifier,
    statement_code: statementCode,
    reservation_id: reservationId ?? null,
    amount: paymentAmount,
    upi_id: PAYMENT_UPI_ID,
    upi_merchant_name: PAYMENT_MERCHANT_NAME,
    upi_uri: upiUri,
    expires_at: expiresAt,
    created_by: createdBy,
  };

  const { data, error } = await supabase
    .from("payment_requests")
    .insert(payload)
    .select(PAYMENT_REQUEST_SELECT)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return toPaymentRequest(data as unknown as DbPaymentRequest);
}

export async function reconcilePaymentRequests(
  supabase: SupabaseClient,
  options: { reservationId?: string | null } = {}
): Promise<{ matched: number; expired: number }> {
  const expired = await markExpiredPaymentRequests(supabase, options);

  let query = supabase
    .from("payment_requests")
    .select(
      "id, identifier, statement_code, upi_uri, amount, requested_at, expires_at"
    )
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  if (options.reservationId) {
    query = query.eq("reservation_id", options.reservationId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  const pendingRequests = ((data ?? []) as unknown as Array<{
    id: string;
    identifier: string;
    statement_code: string | null;
    upi_uri: string;
    amount: number | string;
    requested_at: string;
    expires_at: string;
  }>).map<PendingPaymentRequestMatch>((row) => ({
    id: row.id,
    identifier: row.identifier,
    statementCode:
      row.statement_code ?? getStatementCodeFromUpiUri(row.upi_uri),
    amount: readMoney(row.amount),
    requestedAt: row.requested_at,
    expiresAt: row.expires_at,
  }));

  if (pendingRequests.length === 0) {
    return { matched: 0, expired };
  }

  const payload = await fetchGoogleSheetTransactions();
  const usedPaymentReferences = await listUsedPaymentReferences(supabase);
  const matches = findPaymentRequestMatches(pendingRequests, payload.rows, {
    usedPaymentReferences,
  });

  for (const match of matches) {
    const { error: updateError } = await supabase.rpc(
      "mark_payment_request_paid",
      {
        p_payment_request_id: match.request.id,
        p_paid_amount: match.request.amount,
        p_payment_reference: match.transaction.reference,
        p_matched_transaction: match.transaction,
      }
    );

    if (updateError) {
      throw new Error(updateError.message);
    }
  }

  return { matched: matches.length, expired };
}

export async function markPaymentRequestPaidManually(args: {
  supabase: SupabaseClient;
  paymentRequestId: string;
}): Promise<PaymentRequest> {
  const { supabase, paymentRequestId } = args;

  // Manual admin confirm of a single QR. p_paid_amount is null so the function
  // uses the request's own amount; p_matched_transaction is null so this entry
  // is NOT subject to the auto-match unique-reference guard (which only applies
  // when matched_transaction IS NOT NULL), letting many manual confirms share
  // the sentinel reference safely.
  const { data, error } = await supabase.rpc("mark_payment_request_paid", {
    p_payment_request_id: paymentRequestId,
    p_paid_amount: null,
    p_payment_reference: MANUAL_ADMIN_CONFIRM_REFERENCE,
    p_matched_transaction: null,
  });

  if (error) {
    throw new Error(error.message);
  }

  return toPaymentRequest(data as unknown as DbPaymentRequest);
}

async function listUsedPaymentReferences(
  supabase: SupabaseClient
): Promise<ReadonlySet<string>> {
  const { data, error } = await supabase
    .from("payment_requests")
    .select("payment_reference")
    .eq("status", "paid")
    .not("payment_reference", "is", null);

  if (error) {
    throw new Error(error.message);
  }

  const references = ((data ?? []) as unknown as Array<{
    payment_reference: string | null;
  }>).reduce<Set<string>>((accumulator, row) => {
    const reference = normalizePaymentReference(row.payment_reference);
    if (reference) {
      accumulator.add(reference);
    }

    return accumulator;
  }, new Set<string>());

  return references;
}

function toPaymentRequest(row: DbPaymentRequest): PaymentRequest {
  return {
    id: row.id,
    identifier: row.identifier,
    statementCode:
      row.statement_code ?? getStatementCodeFromUpiUri(row.upi_uri),
    reservationId: row.reservation_id,
    folioItemId: row.folio_item_id,
    amount: readMoney(row.amount),
    paidAmount: readMoney(row.paid_amount),
    status: toPaymentRequestStatus(row.status),
    upiId: row.upi_id,
    upiMerchantName: row.upi_merchant_name,
    upiUri: row.upi_uri,
    requestedAt: row.requested_at,
    expiresAt: row.expires_at,
    paidAt: row.paid_at,
    paymentReference: row.payment_reference,
    matchedTransaction: row.matched_transaction,
    notes: row.notes,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function createUniqueIdentifier(
  supabase: SupabaseClient
): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const identifier = createIdentifier();
    const { data, error } = await supabase
      .from("payment_requests")
      .select("id")
      .eq("identifier", identifier)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    if (!data) {
      return identifier;
    }
  }

  throw new Error("Unable to create a unique payment identifier.");
}

async function createUniquePaymentAmount(
  supabase: SupabaseClient,
  amount: number
): Promise<number> {
  const { data, error } = await supabase
    .from("payment_requests")
    .select("amount")
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString());

  if (error) {
    throw new Error(error.message);
  }

  const activeAmounts = ((data ?? []) as unknown as Array<{
    amount: number | string;
  }>).map((row) => readMoney(row.amount));

  return pickAvailablePaymentRequestAmount({
    amount,
    activeAmounts,
    suffixes: createRandomPaymentAmountSuffixes(),
  });
}

async function createUniqueStatementCode(
  supabase: SupabaseClient,
  amount: number
): Promise<string> {
  const { data, error } = await supabase
    .from("payment_requests")
    .select("amount, statement_code")
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString())
    .not("statement_code", "is", null);

  if (error) {
    throw new Error(error.message);
  }

  const activeCodes = ((data ?? []) as unknown as Array<{
    amount: number | string;
    statement_code: string | null;
  }>).reduce(
    (accumulator, row) => {
      if (!row.statement_code) {
        return accumulator;
      }

      const code = row.statement_code.toUpperCase();
      accumulator.codes.add(code);

      if (isSameMoneyAmount(readMoney(row.amount), amount)) {
        accumulator.initialsForAmount.add(code.slice(0, 1));
      }

      return accumulator;
    },
    {
      codes: new Set<string>(),
      initialsForAmount: new Set<string>(),
    }
  );
  const availableInitials = [...STATEMENT_CODE_ALPHABET].filter(
    (letter) => !activeCodes.initialsForAmount.has(letter)
  );

  if (availableInitials.length === 0) {
    throw new Error(
      "Unable to create a payment statement code because all first-letter codes are in use for this amount."
    );
  }

  for (let attempt = 0; attempt < 50; attempt += 1) {
    const initial = availableInitials[randomInt(availableInitials.length)];
    const statementCode = createStatementCode(initial);
    if (activeCodes.codes.has(statementCode)) {
      continue;
    }

    return statementCode;
  }

  throw new Error("Unable to create a unique payment statement code.");
}

function createIdentifier(): string {
  let identifier = "";
  for (let index = 0; index < PAYMENT_IDENTIFIER_LENGTH; index += 1) {
    identifier += IDENTIFIER_ALPHABET[randomInt(IDENTIFIER_ALPHABET.length)];
  }

  return identifier;
}

function createRandomPaymentAmountSuffixes(): number[] {
  const suffixes = [...PAYMENT_AMOUNT_SUFFIX_PAISE];

  for (let index = suffixes.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(index + 1);
    const current = suffixes[index];
    suffixes[index] = suffixes[swapIndex];
    suffixes[swapIndex] = current;
  }

  return suffixes;
}

function createStatementCode(initial: string): string {
  let statementCode = initial;
  for (let index = 1; index < PAYMENT_STATEMENT_CODE_LENGTH; index += 1) {
    statementCode +=
      STATEMENT_CODE_ALPHABET[randomInt(STATEMENT_CODE_ALPHABET.length)];
  }

  if (statementCode.startsWith(PAYMENT_IDENTIFIER_PREFIX)) {
    return createStatementCode(initial);
  }

  return statementCode;
}

async function markExpiredPaymentRequests(
  supabase: SupabaseClient,
  options: { reservationId?: string | null } = {}
): Promise<number> {
  let query = supabase
    .from("payment_requests")
    .update({ status: "expired" })
    .eq("status", "pending")
    .lt("expires_at", new Date().toISOString())
    .select("id");

  if (options.reservationId) {
    query = query.eq("reservation_id", options.reservationId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return Array.isArray(data) ? data.length : 0;
}

function toPaymentRequestStatus(value: string): PaymentRequestStatus {
  if (
    value === "pending" ||
    value === "paid" ||
    value === "expired" ||
    value === "cancelled"
  ) {
    return value;
  }

  return "pending";
}

function readMoney(value: number | string): number {
  if (typeof value === "number") {
    return value;
  }

  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isSameMoneyAmount(left: number, right: number): boolean {
  return Math.round(left * 100) === Math.round(right * 100);
}

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
  PAYMENT_IDENTIFIER_LENGTH,
  PAYMENT_MERCHANT_NAME,
  PAYMENT_REQUEST_EXPIRY_HOURS,
  PAYMENT_UPI_ID,
  type PendingPaymentRequestMatch,
} from "@/lib/payments/payment-request-matching";

const IDENTIFIER_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const PAYMENT_REQUEST_SELECT = [
  "id",
  "identifier",
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
  const identifier = await createUniqueIdentifier(supabase);
  const upiUri = buildUpiPaymentUri({ identifier, amount });
  const expiresAt = new Date(
    Date.now() + PAYMENT_REQUEST_EXPIRY_HOURS * 60 * 60 * 1000
  ).toISOString();

  const payload: PaymentRequestInsert = {
    identifier,
    reservation_id: reservationId ?? null,
    amount,
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
    .select("id, identifier, amount, expires_at")
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
    amount: number | string;
    expires_at: string;
  }>).map<PendingPaymentRequestMatch>((row) => ({
    id: row.id,
    identifier: row.identifier,
    amount: readMoney(row.amount),
    expiresAt: row.expires_at,
  }));

  if (pendingRequests.length === 0) {
    return { matched: 0, expired };
  }

  const payload = await fetchGoogleSheetTransactions();
  const matches = findPaymentRequestMatches(pendingRequests, payload.rows);

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

function toPaymentRequest(row: DbPaymentRequest): PaymentRequest {
  return {
    id: row.id,
    identifier: row.identifier,
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

function createIdentifier(): string {
  let identifier = "";
  for (let index = 0; index < PAYMENT_IDENTIFIER_LENGTH; index += 1) {
    identifier += IDENTIFIER_ALPHABET[randomInt(IDENTIFIER_ALPHABET.length)];
  }

  return identifier;
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

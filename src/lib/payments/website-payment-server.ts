import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { PaymentRequest } from "@/data/types";
import {
  computeBookingBalanceDue,
  type BookingBalanceReservation,
} from "@/lib/payments/booking-balance";
import {
  createPaymentRequest,
  listPaymentRequests,
  reconcilePaymentRequests,
} from "@/lib/payments/payment-requests-server";

// Server-side glue for the PUBLIC website payment flow. The reservation UUID is
// the access token; everything here runs with the service-role client behind the
// public /api/book routes and reuses the exact admin payment building blocks.

type BookingReservationRow = {
  id: string;
  booking_id: string;
  status: string;
  hold_expires_at: string | null;
  total_amount: number | string;
  tax_enabled_snapshot: boolean | null;
  tax_rate_snapshot: number | string | null;
  folio_items: Array<{ amount: number | string }> | null;
};

const BOOKING_RESERVATION_SELECT =
  "id, booking_id, status, hold_expires_at, total_amount, tax_enabled_snapshot, tax_rate_snapshot, folio_items(amount)";

async function loadBookingReservations(
  supabase: SupabaseClient,
  reservationId: string
): Promise<BookingReservationRow[] | null> {
  const { data: anchor, error: anchorError } = await supabase
    .from("reservations")
    .select("booking_id")
    .eq("id", reservationId)
    .maybeSingle();

  if (anchorError) {
    throw new Error(anchorError.message);
  }

  const bookingId = (anchor as { booking_id: string } | null)?.booking_id;
  if (!bookingId) {
    return null;
  }

  const { data, error } = await supabase
    .from("reservations")
    .select(BOOKING_RESERVATION_SELECT)
    .eq("booking_id", bookingId);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as unknown as BookingReservationRow[];
}

function toBalanceReservation(
  row: BookingReservationRow
): BookingBalanceReservation {
  return {
    totalAmount: Number(row.total_amount),
    taxEnabledSnapshot: Boolean(row.tax_enabled_snapshot),
    taxRateSnapshot: Number(row.tax_rate_snapshot ?? 0),
    folio: (row.folio_items ?? []).map((item, index) => ({
      id: `folio-${index}`,
      description: "",
      amount: Number(item.amount),
      timestamp: "",
    })),
  };
}

export type WebsitePaymentRequestResult =
  | { status: "confirmed" }
  | { status: "pending"; paymentRequest: PaymentRequest };

/**
 * Idempotently return the active UPI payment request for a booking. A second
 * call (page refresh / back button) returns the SAME request — never a new one,
 * since each request picks a different paise suffix and a duplicate would make
 * the amount the guest pays fail to match.
 *
 * Returns null when the reservation id is unknown.
 */
export async function getOrCreateWebsitePaymentRequest(
  supabase: SupabaseClient,
  reservationId: string
): Promise<WebsitePaymentRequestResult | null> {
  const reservations = await loadBookingReservations(supabase, reservationId);
  if (!reservations || reservations.length === 0) {
    return null;
  }

  if (reservations.some((row) => row.status === "Confirmed")) {
    return { status: "confirmed" };
  }

  const now = Date.now();
  const existing = (await listPaymentRequests(supabase, { reservationId })).find(
    (request) =>
      request.status === "pending" &&
      new Date(request.expiresAt).getTime() > now
  );
  if (existing) {
    return { status: "pending", paymentRequest: existing };
  }

  const amount = computeBookingBalanceDue(
    reservations.map(toBalanceReservation)
  );
  if (amount <= 0) {
    // Nothing left to collect — treat the booking as already settled.
    return { status: "confirmed" };
  }

  const paymentRequest = await createPaymentRequest({
    supabase,
    amount,
    createdBy: null,
    reservationId,
  });

  return { status: "pending", paymentRequest };
}

export type WebsitePaymentStatus = {
  status: "pending" | "confirmed" | "expired";
  serverTime: string;
  expiresAt: string | null;
};

/**
 * Best-effort reconcile (pulls fresh bank transactions for this booking) then
 * reports the booking's payment state. A Google Sheet hiccup must not fail the
 * poll, so reconcile errors are swallowed and we still report the DB state.
 *
 * Returns null when the reservation id is unknown.
 */
export async function getWebsitePaymentStatus(
  supabase: SupabaseClient,
  reservationId: string
): Promise<WebsitePaymentStatus | null> {
  try {
    await reconcilePaymentRequests(supabase, { reservationId });
  } catch (error) {
    console.error("Website payment reconcile failed", error);
  }

  const reservations = await loadBookingReservations(supabase, reservationId);
  if (!reservations || reservations.length === 0) {
    return null;
  }

  const serverTime = new Date().toISOString();
  const now = Date.now();

  if (reservations.some((row) => row.status === "Confirmed")) {
    return { status: "confirmed", serverTime, expiresAt: null };
  }

  const requests = await listPaymentRequests(supabase, { reservationId });
  const pending = requests.find((request) => request.status === "pending");

  // The room hold (30 min) lapses well before the payment request (3 h). Once
  // every room's hold has lapsed the room is free again, so report "expired".
  const holdLapsed = reservations.every(
    (row) =>
      row.hold_expires_at != null &&
      new Date(row.hold_expires_at).getTime() <= now
  );

  if (!holdLapsed && pending) {
    return { status: "pending", serverTime, expiresAt: pending.expiresAt };
  }

  return {
    status: "expired",
    serverTime,
    expiresAt: pending?.expiresAt ?? requests[0]?.expiresAt ?? null,
  };
}

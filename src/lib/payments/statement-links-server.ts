import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { isReservationUuid } from "@/lib/reservations/identifiers";
import type { StatementBookingLink } from "@/lib/payments/statement-links";

const STATEMENT_LINK_SELECT = [
  "transaction_id",
  "reservation_id",
  "reservations(booking_id)",
].join(", ");

type DbStatementLinkRow = {
  transaction_id: string | null;
  reservation_id: string | null;
  reservations:
    | { booking_id: string | null }
    | Array<{ booking_id: string | null }>
    | null;
};

// Gateway payments carry the bank reference in transaction_id, so the statement page can
// map each incoming transaction (by reference) to the booking it was recorded against.
export async function getStatementBookingLinks(args: {
  supabase: SupabaseClient;
}): Promise<StatementBookingLink[]> {
  const { data, error } = await args.supabase
    .from("folio_items")
    .select(STATEMENT_LINK_SELECT)
    .eq("payment_method", "UPI Gateway")
    .in("external_source", ["payment_request", "payment_override"])
    .lt("amount", 0)
    .not("transaction_id", "is", null);

  if (error) {
    throw new Error(error.message);
  }

  const links: StatementBookingLink[] = [];
  for (const row of (data ?? []) as unknown as DbStatementLinkRow[]) {
    const reference = row.transaction_id?.trim();
    if (!reference || !row.reservation_id) {
      continue;
    }

    links.push({
      reference,
      reservationId: row.reservation_id,
      bookingId: firstRelation(row.reservations)?.booking_id ?? null,
    });
  }

  return links;
}

// Resolves the typed booking id (human booking code or reservation UUID) to a reservation
// and records the statement transaction's amount as a UPI Gateway payment on it.
export async function attachStatementPaymentToBooking(args: {
  supabase: SupabaseClient;
  bookingId: string;
  amount: number;
  reference: string;
  actorUserId: string;
}): Promise<{ reservationId: string }> {
  const { supabase, bookingId, amount, reference, actorUserId } = args;

  const reservationId = await resolveReservationId(supabase, bookingId.trim());
  if (!reservationId) {
    throw new Error("Booking not found.");
  }

  const { error } = await supabase.rpc("admin_attach_statement_payment", {
    p_reservation_id: reservationId,
    p_paid_amount: amount,
    p_payment_reference: reference,
    p_actor_user_id: actorUserId,
  });

  if (error) {
    throw new Error(error.message);
  }

  return { reservationId };
}

async function resolveReservationId(
  supabase: SupabaseClient,
  bookingId: string
): Promise<string | null> {
  const column = isReservationUuid(bookingId) ? "id" : "booking_id";
  const { data, error } = await supabase
    .from("reservations")
    .select("id")
    .eq(column, bookingId)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as { id: string } | null)?.id ?? null;
}

function firstRelation<T>(value: T | T[] | null): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value;
}

import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { isReservationUuid } from "@/lib/reservations/identifiers";
import type { StatementBookingLink } from "@/lib/payments/statement-links";

const STATEMENT_LINK_SELECT = [
  "id",
  "transaction_id",
  "reservation_id",
  "external_source",
  "external_metadata",
  "reservations(booking_id)",
].join(", ");

// A gateway payment recorded by the Attach button. Auto-matched rows use
// 'payment_request', and the older admin override flow leaves no source key.
const ATTACHED_EXTERNAL_SOURCE = "payment_override";
const ATTACHED_METADATA_SOURCE = "statement_attach";

type DbStatementLinkRow = {
  id: string;
  transaction_id: string | null;
  reservation_id: string | null;
  external_source: string | null;
  external_metadata: Record<string, unknown> | null;
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
      folioItemId: row.id,
      canUnattach: isStatementAttachment(row),
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

type DbUnattachFolioRow = {
  id: string;
  reservation_id: string | null;
  amount: number | string;
  payment_method: string | null;
  external_source: string | null;
  external_metadata: Record<string, unknown> | null;
};

export type UnattachStatementPaymentResult = {
  reservationId: string | null;
  bookingId: string | null;
  amount: number;
  statusReverted: boolean;
};

// Removes a payment that was attached to the wrong booking. The folio row is deleted
// outright (rather than voided) because the attach RPC refuses any transaction whose
// reference already sits on a gateway folio row regardless of sign — a kept row would
// permanently block re-attaching the payment to the correct booking.
export async function unattachStatementPayment(args: {
  supabase: SupabaseClient;
  folioItemId: string;
}): Promise<UnattachStatementPaymentResult> {
  const { supabase, folioItemId } = args;

  const { data, error } = await supabase
    .from("folio_items")
    .select(
      "id, reservation_id, amount, payment_method, external_source, external_metadata"
    )
    .eq("id", folioItemId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  const folioItem = data as unknown as DbUnattachFolioRow | null;
  if (!folioItem) {
    throw new Error("Payment record not found.");
  }

  const amount = Number(folioItem.amount);
  if (
    folioItem.payment_method !== "UPI Gateway" ||
    !isStatementAttachment(folioItem) ||
    !(amount < 0)
  ) {
    throw new Error(
      "Only a manually attached UPI Gateway payment can be unattached."
    );
  }

  const bookingId = folioItem.reservation_id
    ? await resolveBookingId(supabase, folioItem.reservation_id)
    : null;

  const { error: deleteError } = await supabase
    .from("folio_items")
    .delete()
    .eq("id", folioItem.id);

  if (deleteError) {
    throw new Error(deleteError.message);
  }

  const statusReverted = bookingId
    ? await revertBookingWhenFullyUnpaid(supabase, bookingId)
    : false;

  return {
    reservationId: folioItem.reservation_id,
    bookingId,
    amount,
    statusReverted,
  };
}

// Walks the booking back to the non-expiring held state, but only when the unattached
// payment was its last gateway payment — removing one of two payments must not
// un-confirm a booking that is still paid. Never touches Checked-in/Checked-out rooms.
//
// Best effort by design: the payment row is already gone, and reservations carry a
// room-overlap trigger that can reject an unrelated update. A failure here leaves a
// visible, fixable status rather than resurrecting a deleted payment.
async function revertBookingWhenFullyUnpaid(
  supabase: SupabaseClient,
  bookingId: string
): Promise<boolean> {
  try {
    const { count, error: countError } = await supabase
      .from("folio_items")
      .select("id, reservations!inner(booking_id)", {
        count: "exact",
        head: true,
      })
      .eq("reservations.booking_id", bookingId)
      .eq("payment_method", "UPI Gateway")
      .in("external_source", ["payment_request", "payment_override"])
      .lt("amount", 0);

    if (countError) {
      throw new Error(countError.message);
    }

    if ((count ?? 0) > 0) {
      return false;
    }

    const { error: updateError } = await supabase
      .from("reservations")
      .update({ status: "Pending" })
      .eq("booking_id", bookingId)
      .eq("status", "Confirmed")
      .eq("payment_method", "UPI Gateway");

    if (updateError) {
      throw new Error(updateError.message);
    }

    return true;
  } catch (revertError) {
    console.warn(
      `Unattached payment from booking ${bookingId}, but could not revert its status:`,
      revertError instanceof Error ? revertError.message : revertError
    );
    return false;
  }
}

function isStatementAttachment(row: {
  external_source: string | null;
  external_metadata: Record<string, unknown> | null;
}): boolean {
  return (
    row.external_source === ATTACHED_EXTERNAL_SOURCE &&
    row.external_metadata?.source === ATTACHED_METADATA_SOURCE
  );
}

async function resolveBookingId(
  supabase: SupabaseClient,
  reservationId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("reservations")
    .select("booking_id")
    .eq("id", reservationId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as { booking_id: string | null } | null)?.booking_id ?? null;
}

async function resolveReservationId(
  supabase: SupabaseClient,
  bookingId: string
): Promise<string | null> {
  const column = isReservationUuid(bookingId) ? "id" : "booking_id";
  let query = supabase.from("reservations").select("id").eq(column, bookingId);

  // A booking code (A####) is shared by every room in the booking, including any
  // rooms auto-cancelled when the booking was modified. Without this guard an
  // unordered limit(1) can land on a dead reservation, and the RPC then rejects
  // the whole attach with "Cannot attach a payment to a Cancelled or No-show
  // booking." Prefer a live room; order deterministically toward the current stay.
  if (column === "booking_id") {
    query = query
      .not("status", "in", "(Cancelled,No-show)")
      .order("check_out_date", { ascending: false })
      .order("id", { ascending: true });
  }

  const { data, error } = await query.limit(1).maybeSingle();

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

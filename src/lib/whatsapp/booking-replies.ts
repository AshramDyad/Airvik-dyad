import { createServerSupabaseClient } from "@/integrations/supabase/server";
import {
  computeBookingBalanceDue,
  type BookingBalanceReservation,
} from "@/lib/payments/booking-balance";

import { normalizePhone } from "./cloud-api";
import type { BotReply, InboundMessage } from "./types";

/** Stable button ids the webhook routes on (kept in sync with `buildMenu`). */
export const BUTTON_BOOKING_DETAILS = "booking_details";
export const BUTTON_BALANCE_DUE = "balance_due";
export const BUTTON_TALK_SUPPORT = "talk_support";

/** Minimal booking facts the bot needs to answer a guest. */
export interface BookingSummary {
  guestName: string;
  bookingId: string;
  status: string;
  checkInDate: string;
  balanceDue: number;
}

/** "₹1,234.50" — Indian-grouped rupees. */
function formatRupees(amount: number): string {
  return `₹${amount.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** The three-button menu shown on first contact / unrecognized input. */
function buildMenu(greetingName?: string): BotReply {
  const who = greetingName ? ` ${greetingName}` : "";
  return {
    kind: "buttons",
    body: `Hello${who}! How can we help with your booking today?`,
    buttons: [
      { id: BUTTON_BOOKING_DETAILS, title: "Booking details" },
      { id: BUTTON_BALANCE_DUE, title: "Balance due" },
      { id: BUTTON_TALK_SUPPORT, title: "Talk to support" },
    ],
  };
}

/**
 * Decide the reply for one inbound message given the looked-up booking (or null
 * when no booking matches the sender). Pure — no I/O — so it is unit-tested.
 */
export function routeInbound(input: InboundMessage, booking: BookingSummary | null): BotReply {
  if (!booking) {
    return {
      kind: "text",
      body:
        "We couldn't find a booking linked to this number. If you've booked with us, " +
        "please reply with your booking ID or contact support and we'll help right away.",
    };
  }

  switch (input.buttonId) {
    case BUTTON_BOOKING_DETAILS:
      return {
        kind: "text",
        body:
          `Here are your booking details:\n\n` +
          `• Booking ID: ${booking.bookingId}\n` +
          `• Status: ${booking.status}\n` +
          `• Check-in: ${booking.checkInDate}\n` +
          `• Balance due: ${formatRupees(booking.balanceDue)}`,
      };
    case BUTTON_BALANCE_DUE:
      return {
        kind: "text",
        body:
          booking.balanceDue > 0
            ? `Your outstanding balance is ${formatRupees(booking.balanceDue)} for booking ${booking.bookingId}.`
            : `You're all paid up for booking ${booking.bookingId} — nothing due. See you soon!`,
      };
    case BUTTON_TALK_SUPPORT:
      return {
        kind: "text",
        body: "Thanks — a team member will reply here shortly. You can also call us anytime during support hours.",
      };
    default:
      // Any free-form text or unknown button → show the menu.
      return buildMenu(booking.guestName);
  }
}

// ---- Data access ----

interface GuestRow {
  id: string;
}

interface FolioAmountRow {
  amount: number | string | null;
}

interface ReservationRow {
  booking_id: string;
  status: string;
  check_in_date: string;
  booking_date: string | null;
  total_amount: number;
  tax_enabled_snapshot: boolean | null;
  tax_rate_snapshot: number | null;
  guest: { first_name: string | null; last_name: string | null } | null;
  folio: FolioAmountRow[] | null;
}

const RESERVATION_SELECT =
  "booking_id, status, check_in_date, booking_date, total_amount, tax_enabled_snapshot, tax_rate_snapshot, guest:guests(first_name,last_name), folio:folio_items(amount)";

/** Map db reservation rows to the shape `computeBookingBalanceDue` expects. */
function toBalanceInput(rows: ReservationRow[]): BookingBalanceReservation[] {
  return rows.map((row) => ({
    totalAmount: Number(row.total_amount),
    taxEnabledSnapshot: Boolean(row.tax_enabled_snapshot ?? false),
    taxRateSnapshot: row.tax_rate_snapshot ?? 0,
    // calculateReservationFinancials only reads `amount`; cast the minimal shape.
    folio: (row.folio ?? []).map((f) => ({
      amount: Number(f.amount ?? 0),
    })) as unknown as BookingBalanceReservation["folio"],
  }));
}

/**
 * Find the sender's most relevant booking by phone. Matches on the last 10 digits
 * (guests may be stored with/without country code or spacing), picks the newest
 * non-cancelled booking, and sums the balance across all rooms in that booking.
 */
export async function lookupBookingByPhone(phone: string): Promise<BookingSummary | null> {
  const last10 = normalizePhone(phone).slice(-10);
  if (last10.length < 10) {
    return null;
  }

  const supabase = createServerSupabaseClient();

  const { data: guestData } = await supabase
    .from("guests")
    .select("id")
    .ilike("phone", `%${last10}%`);
  const guestIds = ((guestData as GuestRow[] | null) ?? []).map((g) => g.id);
  if (guestIds.length === 0) {
    return null;
  }

  const { data: resData } = await supabase
    .from("reservations")
    .select(RESERVATION_SELECT)
    .in("guest_id", guestIds)
    .order("booking_date", { ascending: false });

  const reservations = (resData as ReservationRow[] | null) ?? [];
  if (reservations.length === 0) {
    return null;
  }

  // Prefer the newest non-cancelled booking; fall back to the newest overall.
  const target =
    reservations.find((r) => r.status !== "Cancelled" && r.status !== "No-show") ?? reservations[0];

  const bookingRooms = reservations.filter((r) => r.booking_id === target.booking_id);
  const balanceDue = computeBookingBalanceDue(toBalanceInput(bookingRooms));

  const first = bookingRooms[0];
  const guestName = [first.guest?.first_name, first.guest?.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();

  return {
    guestName,
    bookingId: target.booking_id,
    status: target.status,
    checkInDate: target.check_in_date,
    balanceDue,
  };
}

/** Look up the booking and decide the reply for one inbound message. */
export async function handleInbound(input: InboundMessage): Promise<BotReply> {
  const booking = await lookupBookingByPhone(input.from);
  return routeInbound(input, booking);
}

import { createServerSupabaseClient } from "@/integrations/supabase/server";

import { sendWhatsAppTemplate } from "./cloud-api";
import { logWhatsAppMessage } from "./store";

/** Approved UTILITY template + language used for proactive booking confirmations. */
const CONFIRMATION_TEMPLATE = "booking_confirmation";
const CONFIRMATION_LANGUAGE = "en_US";

interface ConfirmationRow {
  booking_id: string;
  check_in_date: string;
  guest: { first_name: string | null; last_name: string | null; phone: string | null } | null;
}

/**
 * Best-effort booking-confirmation send. Proactive (no open 24h window is
 * assumed), so it uses the approved `booking_confirmation` UTILITY template with
 * params [guestName, bookingId, checkInDate]. Fully guarded — it never throws,
 * so callers can fire-and-forget without risking the payment flow.
 */
export async function sendBookingConfirmation(reservationId: string): Promise<void> {
  try {
    const supabase = createServerSupabaseClient();
    const { data } = await supabase
      .from("reservations")
      .select("booking_id, check_in_date, guest:guests(first_name,last_name,phone)")
      .eq("id", reservationId)
      .maybeSingle();

    const row = data as ConfirmationRow | null;
    const phone = row?.guest?.phone;
    if (!row || !phone) {
      return;
    }

    const guestName =
      [row.guest?.first_name, row.guest?.last_name].filter(Boolean).join(" ").trim() || "Guest";
    const params = [guestName, row.booking_id, row.check_in_date];

    const result = await sendWhatsAppTemplate(
      phone,
      CONFIRMATION_TEMPLATE,
      CONFIRMATION_LANGUAGE,
      params,
    );

    await logWhatsAppMessage({
      direction: "out",
      phone,
      messageType: `template:${CONFIRMATION_TEMPLATE}`,
      payload: { reservationId, params },
      status: result.success ? "sent" : `error: ${result.error}`,
      reservationId,
    });
  } catch (err) {
    console.error("[WhatsApp] booking confirmation failed", err);
  }
}

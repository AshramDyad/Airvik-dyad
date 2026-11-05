import "server-only";

import { createHash } from "node:crypto";
import { z } from "zod";
import { createServerSupabaseClient } from "@/integrations/supabase/server";
import { HttpError } from "@/lib/server/auth";
import { normalizePhone } from "@/lib/whatsapp/cloud-api";

const reservationSchema = z.object({
  id: z.string().uuid(), booking_id: z.string().min(1), guest_id: z.string().uuid().nullable(),
  status: z.string(), check_in_date: z.string(), check_out_date: z.string(),
});
const guestSchema = z.object({ first_name: z.string().nullable(), last_name: z.string().nullable(), phone: z.string().nullable() });

export interface BookingConfirmation {
  reservationId: string;
  bookingId: string;
  phone: string;
  message: string;
  parameters: [string, string, string, string];
  previewToken: string;
}

function formatDate(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new HttpError(409, "The booking has an invalid date.");
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new HttpError(409, "The booking has an invalid date.");
  }
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(date);
}

export async function loadBookingConfirmation(reservationId: string): Promise<BookingConfirmation> {
  const supabase = createServerSupabaseClient();
  const selected = await supabase.from("reservations")
    .select("id,booking_id,guest_id,status,check_in_date,check_out_date")
    .eq("id", reservationId).maybeSingle();
  if (selected.error) throw selected.error;
  if (!selected.data) throw new HttpError(404, "Booking not found.");
  const primary = reservationSchema.parse(selected.data);
  const result = await supabase.from("reservations")
    .select("id,booking_id,guest_id,status,check_in_date,check_out_date", { count: "exact" })
    .eq("booking_id", primary.booking_id).range(0, 9999);
  if (result.error) throw result.error;
  const rows = z.array(reservationSchema).parse(result.data);
  if (result.count === null || rows.length !== result.count) throw new HttpError(409, "Could not load the complete booking.");
  const active = rows.filter((row) => row.status !== "Cancelled");
  if (active.length === 0 || active.some((row) => row.status !== "Confirmed")) {
    throw new HttpError(409, "All active rooms must be confirmed before sending.");
  }
  const guestId = active[0].guest_id;
  if (!guestId || active.some((row) => row.guest_id !== guestId)) {
    throw new HttpError(409, "The booking does not have one guest for all rooms.");
  }
  const guestResult = await supabase.from("guests").select("first_name,last_name,phone").eq("id", guestId).maybeSingle();
  if (guestResult.error) throw guestResult.error;
  if (!guestResult.data) throw new HttpError(404, "Guest not found.");
  const guest = guestSchema.parse(guestResult.data);
  const guestName = [guest.first_name, guest.last_name].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
  const rawPhone = guest.phone?.trim() ?? "";
  const normalizedPhone = normalizePhone(rawPhone);
  if (!guestName) throw new HttpError(409, "The guest has no name.");
  if (!/^\+?[\d\s().-]+$/.test(rawPhone) || !/^[1-9]\d{7,14}$/.test(normalizedPhone)) {
    throw new HttpError(409, "The guest has no valid phone number.");
  }
  const checkIn = active.map((row) => row.check_in_date).sort()[0];
  const checkOut = active.map((row) => row.check_out_date).sort().at(-1);
  if (!checkOut) throw new HttpError(409, "The booking has no departure date.");
  const parameters: BookingConfirmation["parameters"] = [guestName, primary.booking_id, formatDate(checkIn), formatDate(checkOut)];
  const phone = `+${normalizedPhone}`;
  const message = `Hello ${parameters[0]}, your booking ${parameters[1]} at Sahajanand Wellness Trust is confirmed.\nCheck-in: ${parameters[2]}\nCheck-out: ${parameters[3]}\nWe look forward to welcoming you.`;
  const previewToken = createHash("sha256").update(JSON.stringify([phone, ...parameters])).digest("hex");
  return { reservationId, bookingId: primary.booking_id, phone, message, parameters, previewToken };
}

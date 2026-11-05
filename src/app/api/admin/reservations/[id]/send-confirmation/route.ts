import { NextResponse } from "next/server";
import { z } from "zod";
import { logAdminActivityFromProfile } from "@/lib/activity/server";
import { HttpError, requirePermission } from "@/lib/server/auth";
import { getEnvNumberConfig } from "@/lib/whatsapp/config";
import { sendWhatsAppTemplate } from "@/lib/whatsapp/cloud-api";
import { loadBookingConfirmation } from "@/server/reservations/booking-confirmation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };
const requestSchema = z.object({ consent: z.literal(true), previewToken: z.string().regex(/^[a-f0-9]{64}$/) });
const noStore = { "Cache-Control": "private, no-store" };
const uncertainMessage = "Couldn't confirm sending—check WhatsApp before retrying.";

async function checkedId(context: Context): Promise<string> {
  const parsed = z.string().uuid().safeParse((await context.params).id);
  if (!parsed.success) throw new HttpError(400, "Invalid reservation ID.");
  return parsed.data;
}

function errorResponse(error: unknown): NextResponse {
  if (error instanceof HttpError) return NextResponse.json({ message: error.message }, { status: error.status, headers: noStore });
  console.error("[WhatsAppConfirmation] Request failed", error);
  return NextResponse.json({ message: "Could not prepare the confirmation." }, { status: 500, headers: noStore });
}

export async function GET(request: Request, context: Context) {
  try {
    await requirePermission(request, "update:reservation");
    const { phone, message, previewToken } = await loadBookingConfirmation(await checkedId(context));
    return NextResponse.json({ phone, message, previewToken }, { headers: noStore });
  } catch (error) { return errorResponse(error); }
}

export async function POST(request: Request, context: Context) {
  try {
    const actor = await requirePermission(request, "update:reservation");
    const id = await checkedId(context);
    const body: unknown = await request.json().catch(() => null);
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) throw new HttpError(400, "Confirm the guest's permission before sending.");
    const confirmation = await loadBookingConfirmation(id);
    if (confirmation.previewToken !== parsed.data.previewToken) {
      throw new HttpError(409, "The booking or phone number changed. Close and preview it again.");
    }
    let config;
    try { config = getEnvNumberConfig(); }
    catch { throw new HttpError(503, "WhatsApp is not configured yet."); }
    const result = await sendWhatsAppTemplate(confirmation.phone, "booking_confirmation", "en_US", confirmation.parameters, {
      config, signal: AbortSignal.timeout(10_000),
    });
    if (!result.success) {
      if (result.unconfirmed) return NextResponse.json({ message: uncertainMessage }, { status: 504, headers: noStore });
      if (result.metaCode === 132001) return NextResponse.json({ message: "The booking confirmation template is not approved or available in WhatsApp yet." }, { status: 502, headers: noStore });
      return NextResponse.json({ message: "WhatsApp could not accept the confirmation. Please check the account and try again." }, { status: 502, headers: noStore });
    }
    if (!result.messageId) return NextResponse.json({ message: uncertainMessage }, { status: 504, headers: noStore });
    try {
      await logAdminActivityFromProfile({ profile: actor, entry: {
        section: "reservations", entityType: "reservation", entityId: id, entityLabel: confirmation.bookingId,
        action: "send_whatsapp_confirmation", details: "Booking confirmation submitted to WhatsApp.",
        metadata: { bookingId: confirmation.bookingId, messageId: result.messageId },
      } });
    } catch (error) { console.error("[WhatsAppConfirmation] Activity logging failed", { bookingId: confirmation.bookingId, messageId: result.messageId, error }); }
    console.info("[WhatsAppConfirmation] Submitted", { bookingId: confirmation.bookingId, messageId: result.messageId });
    return NextResponse.json({ success: true }, { headers: noStore });
  } catch (error) { return errorResponse(error); }
}

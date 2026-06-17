import { NextResponse } from "next/server";
import { z } from "zod";
import { createHash, randomInt } from "node:crypto";

import { createServerSupabaseClient } from "@/integrations/supabase/server";
import { HttpError, requirePermissions } from "@/lib/server/auth";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { DISCOUNT_OTP_THRESHOLD } from "@/lib/reservations/discount-approval";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RequestSchema = z.object({
  guestName: z.string().min(1).max(120),
  customAmount: z.coerce.number().nonnegative(),
  originalAmount: z.coerce.number().nonnegative(),
});

const OTP_TTL_MS = 10 * 60 * 1000;
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX = 5;

type PropertyOtpRow = { whatsapp_otp_phone: string | null };
type InsertedOtpRow = { id: string };

export async function POST(request: Request) {
  try {
    // Only users who can create reservations may trigger an approval OTP.
    await requirePermissions(request, "create:reservation");

    const { guestName, customAmount, originalAmount } = RequestSchema.parse(
      await request.json()
    );

    const discount = originalAmount - customAmount;
    if (discount <= DISCOUNT_OTP_THRESHOLD) {
      throw new HttpError(400, "Discount is within the allowed limit; no approval needed.");
    }

    const supabase = createServerSupabaseClient();

    const { data: propertyData } = await supabase
      .from("properties")
      .select("whatsapp_otp_phone")
      .limit(1)
      .maybeSingle();
    const recipient = (propertyData as PropertyOtpRow | null)?.whatsapp_otp_phone?.trim();
    if (!recipient) {
      throw new HttpError(400, "Set the WhatsApp approval number in Settings first.");
    }

    // Simple per-recipient rate limit over the recent window.
    const windowStart = new Date(Date.now() - RATE_WINDOW_MS).toISOString();
    const { count } = await supabase
      .from("reservation_otp_codes")
      .select("id", { count: "exact", head: true })
      .eq("recipient_phone", recipient)
      .gte("created_at", windowStart);
    if ((count ?? 0) >= RATE_MAX) {
      throw new HttpError(429, "Too many approval requests. Please wait a few minutes.");
    }

    const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
    const codeHash = createHash("sha256").update(code).digest("hex");
    const expiresAt = new Date(Date.now() + OTP_TTL_MS).toISOString();

    const { data: insertedData, error: insertError } = await supabase
      .from("reservation_otp_codes")
      .insert({
        recipient_phone: recipient,
        code_hash: codeHash,
        guest_name: guestName,
        custom_amount: customAmount,
        original_amount: originalAmount,
        expires_at: expiresAt,
      })
      .select("id")
      .single();

    const inserted = insertedData as InsertedOtpRow | null;
    if (insertError || !inserted) {
      throw new Error(insertError?.message ?? "Could not create the approval request.");
    }

    const message = [
      "Reservation approval needed",
      `Guest: ${guestName}`,
      `Booking amount: ₹${formatAmount(customAmount)}`,
      `Original amount: ₹${formatAmount(originalAmount)}`,
      `Discount: ₹${formatAmount(discount)}`,
      `OTP: ${code} (valid 10 min)`,
    ].join("\n");

    const sendResult = await sendWhatsAppMessage(recipient, message);
    if (!sendResult.success) {
      // The code never reached anyone — drop the row so a retry isn't rate-limited.
      await supabase.from("reservation_otp_codes").delete().eq("id", inserted.id);
      throw new HttpError(502, `Could not send WhatsApp OTP: ${sendResult.error}`);
    }

    return noStoreJson({ otpId: inserted.id }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

function formatAmount(value: number): string {
  return Math.round(value).toLocaleString("en-IN");
}

function handleApiError(error: unknown): NextResponse {
  if (error instanceof HttpError) {
    return noStoreJson({ message: error.message }, { status: error.status });
  }
  if (error instanceof z.ZodError) {
    return noStoreJson(
      { message: "Invalid OTP request.", issues: error.flatten().fieldErrors },
      { status: 400 }
    );
  }
  if (error instanceof Error && error.message.trim()) {
    return noStoreJson({ message: error.message }, { status: 500 });
  }
  return noStoreJson({ message: "Unable to send OTP." }, { status: 500 });
}

function noStoreJson(body: unknown, init: ResponseInit = {}): NextResponse {
  const headers = new Headers(init.headers);
  headers.set("Cache-Control", "private, no-store");
  return NextResponse.json(body, { ...init, headers });
}

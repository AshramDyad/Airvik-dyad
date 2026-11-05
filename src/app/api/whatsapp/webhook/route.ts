import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/integrations/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const statusSchema = z.object({
  id: z.string().min(1), status: z.enum(["sent", "delivered", "read", "failed", "deleted"]),
  timestamp: z.string().optional(), errors: z.array(z.object({ code: z.number().optional() })).optional(),
});
const webhookSchema = z.object({
  object: z.literal("whatsapp_business_account"),
  entry: z.array(z.object({
    id: z.string(), changes: z.array(z.object({
      field: z.string(), value: z.object({
        metadata: z.object({ phone_number_id: z.string() }).optional(),
        statuses: z.array(z.unknown()).optional(),
        messages: z.array(z.unknown()).optional(),
      }),
    })).optional(),
  })),
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const verifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
  const challenge = url.searchParams.get("hub.challenge");
  if (verifyToken && url.searchParams.get("hub.mode") === "subscribe" &&
      url.searchParams.get("hub.verify_token") === verifyToken && challenge) {
    return new NextResponse(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

export async function POST(request: Request) {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret) return NextResponse.json({ message: "Webhook not configured" }, { status: 503 });
  const rawBody = Buffer.from(await request.arrayBuffer());
  const signature = request.headers.get("x-hub-signature-256") ?? "";
  const expected = `sha256=${createHmac("sha256", secret).update(rawBody).digest("hex")}`;
  const suppliedBytes = Buffer.from(signature);
  const expectedBytes = Buffer.from(expected);
  if (suppliedBytes.length !== expectedBytes.length || !timingSafeEqual(suppliedBytes, expectedBytes)) {
    return NextResponse.json({ message: "Invalid signature" }, { status: 403 });
  }
  let raw: unknown;
  try { raw = JSON.parse(rawBody.toString("utf8")); }
  catch { return NextResponse.json({ message: "Invalid JSON" }, { status: 400 }); }
  const parsed = webhookSchema.safeParse(raw);
  if (parsed.success) {
    const expectedWaba = process.env.WHATSAPP_WABA_ID;
    const expectedPhone = process.env.WHATSAPP_PHONE_NUMBER_ID;
    for (const entry of parsed.data.entry) {
      if (expectedWaba && entry.id !== expectedWaba) continue;
      for (const change of entry.changes ?? []) {
        if (change.field !== "messages" || !expectedPhone || change.value.metadata?.phone_number_id !== expectedPhone) continue;
        for (const rawMessage of change.value.messages ?? []) {
          const message = z.object({ from: z.string().regex(/^[1-9]\d{7,14}$/), timestamp: z.string().regex(/^\d{1,12}$/) }).safeParse(rawMessage);
          if (!message.success || !expectedWaba || entry.id !== expectedWaba) continue;
          const time = Number(message.data.timestamp) * 1000;
          if (time > Date.now() || time < Date.now() - 24 * 60 * 60 * 1000) continue;
          try {
            const { error } = await createServerSupabaseClient().rpc('record_whatsapp_inbound', {
              p_phone: expectedPhone, p_sender: message.data.from, p_at: new Date(time).toISOString(),
            });
            if (error) throw error;
          } catch {
            return NextResponse.json({ message: 'Could not record message window' }, { status: 503 });
          }
        }
        for (const rawStatus of change.value.statuses ?? []) {
          const status = statusSchema.safeParse(rawStatus);
          if (!status.success) continue;
          console.info("[WhatsAppDelivery]", {
            messageId: status.data.id, status: status.data.status, timestamp: status.data.timestamp,
            errorCodes: status.data.errors?.map((error) => error.code).filter((code) => code !== undefined),
          });
        }
      }
    }
  }
  return NextResponse.json({ received: true });
}

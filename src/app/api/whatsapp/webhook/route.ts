import { NextRequest, NextResponse } from "next/server";

import { sendWhatsAppButtons, sendWhatsAppMessage } from "@/lib/whatsapp";
import { handleInbound } from "@/lib/whatsapp/booking-replies";
import { getVerifyToken } from "@/lib/whatsapp/config";
import { verifyWhatsAppSignature } from "@/lib/whatsapp/signature";
import { isHumanHandling, logWhatsAppMessage } from "@/lib/whatsapp/store";
import type { BotReply, InboundMessage } from "@/lib/whatsapp/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ---- Minimal shapes of the Meta webhook payload we read ----
interface WaMessage {
  from: string;
  id: string;
  type: string;
  text?: { body: string };
  interactive?: { type: string; button_reply?: { id: string; title: string } };
}
interface WaChange {
  field: string;
  value: { messages?: WaMessage[] };
}
interface WaEntry {
  id: string;
  changes?: WaChange[];
}
interface WaWebhookBody {
  object?: string;
  entry?: WaEntry[];
}

/** GET: Meta's subscription verification handshake. */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const mode = params.get("hub.mode");
  const token = params.get("hub.verify_token");
  const challenge = params.get("hub.challenge");

  if (mode === "subscribe" && token === getVerifyToken() && challenge) {
    return new NextResponse(challenge, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

/** POST: inbound messages, button taps, and staff message echoes. */
export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-hub-signature-256");

  if (!verifyWhatsAppSignature(rawBody, signature)) {
    return NextResponse.json({ message: "Invalid signature" }, { status: 403 });
  }

  let body: WaWebhookBody;
  try {
    body = JSON.parse(rawBody) as WaWebhookBody;
  } catch {
    return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
  }

  // Best-effort processing; always 200 so Meta doesn't retry-storm. Volume is low
  // enough (50-100/day) that handling inline stays well under Meta's ack timeout.
  try {
    for (const entry of body.entry ?? []) {
      for (const change of entry.changes ?? []) {
        if (change.field === "smb_message_echoes") {
          await handleEchoes(change.value.messages ?? []);
        } else if (change.field === "messages") {
          await handleIncoming(change.value.messages ?? []);
        }
      }
    }
  } catch (err) {
    console.error("[WhatsApp] webhook processing error", err);
  }

  return NextResponse.json({ received: true });
}

/** Staff replied from the WhatsApp Business app — record it; do not bot-reply. */
async function handleEchoes(messages: WaMessage[]): Promise<void> {
  for (const message of messages) {
    await logWhatsAppMessage({
      direction: "echo",
      phone: message.from,
      messageType: message.type,
      payload: message,
    });
  }
}

/** Guest messages / button taps — log, respect human handover, else auto-reply. */
async function handleIncoming(messages: WaMessage[]): Promise<void> {
  for (const message of messages) {
    const input = toInbound(message);
    if (!input) {
      continue;
    }

    await logWhatsAppMessage({
      direction: "in",
      phone: input.from,
      messageType: message.type,
      payload: message,
    });

    if (await isHumanHandling(input.from)) {
      continue;
    }

    const reply = await handleInbound(input);
    await sendReply(input.from, reply);
  }
}

/** Extract the bits the bot needs from a raw message (text body or button id). */
function toInbound(message: WaMessage): InboundMessage | null {
  if (message.type === "text" && message.text?.body) {
    return { from: message.from, text: message.text.body };
  }
  if (message.type === "interactive" && message.interactive?.button_reply) {
    return { from: message.from, buttonId: message.interactive.button_reply.id };
  }
  // Other message types (image, location, …) fall back to the menu.
  return { from: message.from, text: "" };
}

/** Send the bot's decided reply and log the outbound message. */
async function sendReply(phone: string, reply: BotReply): Promise<void> {
  if (reply.kind === "none") {
    return;
  }
  const result =
    reply.kind === "buttons"
      ? await sendWhatsAppButtons(phone, reply.body, reply.buttons)
      : await sendWhatsAppMessage(phone, reply.body);

  await logWhatsAppMessage({
    direction: "out",
    phone,
    messageType: reply.kind,
    payload: reply,
    status: result.success ? "sent" : `error: ${result.error}`,
  });
}

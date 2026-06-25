import { getNumberConfig } from "./config";
import type { ReplyButton, WhatsAppResult } from "./types";

const GRAPH_BASE = "https://graph.facebook.com";

/** Indian-friendly E.164 normalization: strip non-digits, prepend 91 to a bare 10-digit number. */
export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) {
    return `91${digits}`;
  }
  return digits;
}

/** POST a message body to the Graph `/messages` endpoint for the active number. */
async function callSendApi(body: Record<string, unknown>): Promise<WhatsAppResult> {
  try {
    const { apiVersion, phoneNumberId, accessToken } = await getNumberConfig();
    const response = await fetch(`${GRAPH_BASE}/${apiVersion}/${phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ messaging_product: "whatsapp", ...body }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`[WhatsApp] send failed (${response.status}): ${text}`);
      return { success: false, error: `WhatsApp API error: ${response.status}` };
    }

    const json = (await response.json()) as { messages?: Array<{ id?: string }> };
    return { success: true, messageId: json.messages?.[0]?.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`[WhatsApp] send exception: ${message}`);
    return { success: false, error: message };
  }
}

/** Upload a binary to the Graph media endpoint, returning the reusable media id. */
async function uploadMedia(
  file: File | Blob,
  mimeType: string,
): Promise<{ id: string } | { error: string }> {
  try {
    const { apiVersion, phoneNumberId, accessToken } = await getNumberConfig();
    const form = new FormData();
    form.append("messaging_product", "whatsapp");
    form.append("type", mimeType);
    form.append("file", file);

    const response = await fetch(`${GRAPH_BASE}/${apiVersion}/${phoneNumberId}/media`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      body: form,
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`[WhatsApp] media upload failed (${response.status}): ${text}`);
      return { error: `WhatsApp media error: ${response.status}` };
    }

    const json = (await response.json()) as { id?: string };
    if (!json.id) {
      return { error: "WhatsApp media upload returned no id" };
    }
    return { id: json.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`[WhatsApp] media upload exception: ${message}`);
    return { error: message };
  }
}

/** Send a free-form text message (only valid inside the 24h customer-service window). */
export async function sendWhatsAppMessage(phone: string, message: string): Promise<WhatsAppResult> {
  return callSendApi({ to: normalizePhone(phone), type: "text", text: { body: message } });
}

/** Send an interactive message with up to 3 reply buttons. */
export async function sendWhatsAppButtons(
  phone: string,
  body: string,
  buttons: ReplyButton[],
): Promise<WhatsAppResult> {
  return callSendApi({
    to: normalizePhone(phone),
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: body },
      action: {
        buttons: buttons.slice(0, 3).map((button) => ({
          type: "reply",
          reply: { id: button.id, title: button.title },
        })),
      },
    },
  });
}

/**
 * Send a pre-approved template (the only way to message a user outside the 24h
 * window). `params` fill the BODY placeholders {{1}}, {{2}}, … in order.
 */
export async function sendWhatsAppTemplate(
  phone: string,
  templateName: string,
  languageCode: string,
  params: string[] = [],
): Promise<WhatsAppResult> {
  const components =
    params.length > 0
      ? [{ type: "body", parameters: params.map((text) => ({ type: "text", text })) }]
      : [];
  return callSendApi({
    to: normalizePhone(phone),
    type: "template",
    template: {
      name: templateName,
      language: { code: languageCode },
      ...(components.length > 0 ? { components } : {}),
    },
  });
}

/** Send an image (uploads the binary first, then references the media id). */
export async function sendWhatsAppImage(
  phone: string,
  image: File | Blob,
  caption?: string,
): Promise<WhatsAppResult> {
  const media = await uploadMedia(image, image.type || "image/jpeg");
  if ("error" in media) {
    return { success: false, error: media.error };
  }
  return callSendApi({
    to: normalizePhone(phone),
    type: "image",
    image: { id: media.id, ...(caption ? { caption } : {}) },
  });
}

/** Send a document/file (uploads the binary first, then references the media id). */
export async function sendWhatsAppFile(
  phone: string,
  file: File | Blob,
  caption?: string,
): Promise<WhatsAppResult> {
  const media = await uploadMedia(file, file.type || "application/pdf");
  if ("error" in media) {
    return { success: false, error: media.error };
  }
  const filename = file instanceof File ? file.name : undefined;
  return callSendApi({
    to: normalizePhone(phone),
    type: "document",
    document: {
      id: media.id,
      ...(caption ? { caption } : {}),
      ...(filename ? { filename } : {}),
    },
  });
}

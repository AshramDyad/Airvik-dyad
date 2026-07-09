import { createServerSupabaseClient } from "@/integrations/supabase/server";

export type MessageDirection = "in" | "out" | "echo";

export interface LogMessageInput {
  direction: MessageDirection;
  phone: string;
  messageType: string;
  payload: unknown;
  status?: string;
  reservationId?: string | null;
}

/**
 * Append a row to `whatsapp_messages` for audit + the human-handover signal.
 * Best-effort: logging must never break message handling, and the table may not
 * exist yet (migration applied by hand), so failures are swallowed with a warning.
 */
export async function logWhatsAppMessage(input: LogMessageInput): Promise<void> {
  try {
    const supabase = createServerSupabaseClient();
    await supabase.from("whatsapp_messages").insert({
      direction: input.direction,
      wa_phone: input.phone,
      message_type: input.messageType,
      payload: input.payload,
      status: input.status ?? null,
      reservation_id: input.reservationId ?? null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.warn(`[WhatsApp] message log failed: ${message}`);
  }
}

/**
 * True if staff have replied to this guest from the WhatsApp Business app recently
 * (an `echo` row within the window). The bot stays silent so it doesn't talk over
 * a human handling the thread.
 */
export async function isHumanHandling(phone: string, withinMinutes = 30): Promise<boolean> {
  try {
    const supabase = createServerSupabaseClient();
    const cutoff = new Date(Date.now() - withinMinutes * 60 * 1000).toISOString();
    const { data } = await supabase
      .from("whatsapp_messages")
      .select("id")
      .eq("direction", "echo")
      .eq("wa_phone", phone)
      .gte("created_at", cutoff)
      .limit(1);
    return ((data as unknown[] | null) ?? []).length > 0;
  } catch {
    return false;
  }
}

/** Persist onboarding output so the send layer can read the active number config. */
export async function saveWhatsAppConfig(input: {
  phoneNumberId: string;
  accessToken: string;
  wabaId: string | null;
}): Promise<void> {
  const supabase = createServerSupabaseClient();
  const { error } = await supabase.from("whatsapp_config").insert({
    phone_number_id: input.phoneNumberId,
    access_token: input.accessToken,
    waba_id: input.wabaId,
  });
  if (error) {
    throw new Error(`Failed to save WhatsApp config: ${error.message}`);
  }
}

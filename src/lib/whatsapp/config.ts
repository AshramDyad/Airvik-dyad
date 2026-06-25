import { createServerSupabaseClient } from "@/integrations/supabase/server";

/**
 * Number-level credentials for sending on the business number. These are produced
 * by Embedded Signup onboarding and stored in `whatsapp_config`; we fall back to
 * env vars so development against the Meta test number works before onboarding.
 */
export interface WhatsAppNumberConfig {
  apiVersion: string;
  phoneNumberId: string;
  accessToken: string;
  wabaId: string | null;
}

/** Shape of the latest `whatsapp_config` row we read (table is untyped client-side). */
interface WhatsAppConfigRow {
  phone_number_id: string | null;
  access_token: string | null;
  waba_id: string | null;
}

/** Graph API version, e.g. "v22.0". */
export function getApiVersion(): string {
  return process.env.WHATSAPP_API_VERSION || "v22.0";
}

/** App secret — used to verify inbound webhook signatures and exchange the signup code. */
export function getAppSecret(): string {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret) {
    throw new Error("Missing WHATSAPP_APP_SECRET environment variable.");
  }
  return secret;
}

/** App id — used by Embedded Signup and the code→token exchange. */
export function getAppId(): string {
  const appId = process.env.WHATSAPP_APP_ID || process.env.NEXT_PUBLIC_WHATSAPP_APP_ID;
  if (!appId) {
    throw new Error("Missing WHATSAPP_APP_ID environment variable.");
  }
  return appId;
}

/** Self-chosen token echoed back during the webhook GET verification handshake. */
export function getVerifyToken(): string {
  const token = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
  if (!token) {
    throw new Error("Missing WHATSAPP_WEBHOOK_VERIFY_TOKEN environment variable.");
  }
  return token;
}

/**
 * Resolve the active number config. Prefers the most recent `whatsapp_config` row
 * (written at onboarding); if the table is empty/absent it falls back to env vars.
 */
export async function getNumberConfig(): Promise<WhatsAppNumberConfig> {
  try {
    const supabase = createServerSupabaseClient();
    const { data } = await supabase
      .from("whatsapp_config")
      .select("phone_number_id, access_token, waba_id")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const row = data as WhatsAppConfigRow | null;
    if (row?.phone_number_id && row?.access_token) {
      return {
        apiVersion: getApiVersion(),
        phoneNumberId: row.phone_number_id,
        accessToken: row.access_token,
        wabaId: row.waba_id ?? null,
      };
    }
  } catch (err) {
    // Table may not exist yet (migration not applied) — fall back to env.
    const message = err instanceof Error ? err.message : "Unknown error";
    console.warn(`[WhatsApp] whatsapp_config lookup failed, using env: ${message}`);
  }

  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!phoneNumberId || !accessToken) {
    throw new Error(
      "Missing WhatsApp number config. Onboard via Embedded Signup, or set WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_ACCESS_TOKEN.",
    );
  }
  return {
    apiVersion: getApiVersion(),
    phoneNumberId,
    accessToken,
    wabaId: process.env.WHATSAPP_WABA_ID ?? null,
  };
}

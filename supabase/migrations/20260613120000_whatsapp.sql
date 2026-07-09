BEGIN;

SET search_path TO public;

-- WhatsApp Cloud API integration (replaces the old GOWA bridge).
--
-- Two tables, both service-role only (RLS enabled with no policies, so anon/auth
-- clients have no access; the service-role key used by server code bypasses RLS):
--   * whatsapp_config   — number credentials produced by Embedded Signup onboarding
--                         (the send layer reads the most recent row).
--   * whatsapp_messages — inbound/outbound/echo log for audit and the human-handover
--                         signal (bot stays silent when staff recently replied).

CREATE TABLE IF NOT EXISTS "public"."whatsapp_config" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "phone_number_id" text NOT NULL,
  "access_token" text NOT NULL,
  "waba_id" text,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE "public"."whatsapp_config" ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS "public"."whatsapp_messages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "direction" text NOT NULL CHECK ("direction" IN ('in', 'out', 'echo')),
  "wa_phone" text NOT NULL,
  "message_type" text,
  "payload" jsonb,
  "status" text,
  "reservation_id" uuid REFERENCES "public"."reservations"("id") ON DELETE SET NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE "public"."whatsapp_messages" ENABLE ROW LEVEL SECURITY;

-- Powers the human-handover lookup (recent echo by phone) and per-guest history.
CREATE INDEX IF NOT EXISTS "whatsapp_messages_phone_created_idx"
  ON "public"."whatsapp_messages" ("wa_phone", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "whatsapp_messages_direction_idx"
  ON "public"."whatsapp_messages" ("direction");

COMMIT;

-- ROLLBACK:
-- DROP TABLE IF EXISTS "public"."whatsapp_messages";
-- DROP TABLE IF EXISTS "public"."whatsapp_config";

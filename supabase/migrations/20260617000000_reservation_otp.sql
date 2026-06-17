BEGIN;

SET search_path TO public;

-- Discount-approval OTP for admin reservations.
--
-- When an admin discounts a room's nightly rate beyond the threshold, the booking
-- must be approved by the owner via a one-time code sent over WhatsApp.
--
-- reservation_otp_codes is service-role only (RLS enabled with no policies, so
-- anon/authenticated clients have no access; the server routes use the service-role
-- key which bypasses RLS). Only the hash of the code is stored.

CREATE TABLE IF NOT EXISTS "public"."reservation_otp_codes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "recipient_phone" text NOT NULL,
  "code_hash" text NOT NULL,
  "guest_name" text,
  "custom_amount" numeric,
  "original_amount" numeric,
  "attempts" integer NOT NULL DEFAULT 0,
  "consumed_at" timestamptz,
  "expires_at" timestamptz NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE "public"."reservation_otp_codes" ENABLE ROW LEVEL SECURITY;

-- Powers the per-recipient rate-limit window lookup.
CREATE INDEX IF NOT EXISTS "reservation_otp_codes_recipient_created_idx"
  ON "public"."reservation_otp_codes" ("recipient_phone", "created_at" DESC);

-- Owner number that receives discount-approval OTPs. Set in admin Settings.
-- Nullable, no default: existing rows are unaffected (non-breaking).
ALTER TABLE "public"."properties"
  ADD COLUMN IF NOT EXISTS "whatsapp_otp_phone" text;

COMMIT;

-- ROLLBACK:
-- ALTER TABLE "public"."properties" DROP COLUMN IF EXISTS "whatsapp_otp_phone";
-- DROP TABLE IF EXISTS "public"."reservation_otp_codes";

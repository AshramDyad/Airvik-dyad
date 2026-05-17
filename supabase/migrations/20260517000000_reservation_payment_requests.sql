-- Add UPI settings to property profile and reservation payment request support.

-- Existing dashboards and booking flows may need a configurable UPI target
-- for generating deep links and QR payloads.
ALTER TABLE "public"."properties"
  ADD COLUMN IF NOT EXISTS "upi_id" text,
  ADD COLUMN IF NOT EXISTS "upi_merchant_name" text;

CREATE TABLE IF NOT EXISTS "public"."reservation_payment_requests" (
    "id" uuid DEFAULT gen_random_uuid() NOT NULL,
    "token" text NOT NULL,
    "reservation_ids" uuid[] NOT NULL,
    "amount" numeric(12,2) NOT NULL,
    "paid_amount" numeric(12,2) NOT NULL DEFAULT 0,
    "status" text NOT NULL DEFAULT 'requested',
    "notes" text,
    "requested_at" timestamptz NOT NULL DEFAULT now(),
    "paid_at" timestamptz,
    "expires_at" timestamptz,
    "payment_method" text NOT NULL DEFAULT 'UPI',
    "payment_reference" text,
    "external_metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
    "created_by" uuid,
    "created_at" timestamptz NOT NULL DEFAULT now(),
    "updated_at" timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT "reservation_payment_requests_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "reservation_payment_requests_token_key" UNIQUE ("token"),
    CONSTRAINT "reservation_payment_requests_status_check" CHECK (
      "status" = ANY (
        ARRAY[
          'requested'::text,
          'partially_paid'::text,
          'paid'::text,
          'expired'::text,
          'cancelled'::text
        ]::text[]
      )
    ),
    CONSTRAINT "reservation_payment_requests_amount_positive" CHECK ("amount" > 0),
    CONSTRAINT "reservation_payment_requests_paid_amount_non_negative" CHECK ("paid_amount" >= 0),
    CONSTRAINT "reservation_payment_requests_paid_amount_within_amount" CHECK ("paid_amount" <= "amount"),
    CONSTRAINT "reservation_payment_requests_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL
);

CREATE INDEX "reservation_payment_requests_token_idx" ON "public"."reservation_payment_requests" USING btree ("token");
CREATE INDEX "reservation_payment_requests_status_idx" ON "public"."reservation_payment_requests" USING btree ("status");
CREATE INDEX "reservation_payment_requests_expires_at_idx" ON "public"."reservation_payment_requests" USING btree ("expires_at")
  WHERE ("expires_at" IS NOT NULL);
CREATE INDEX "reservation_payment_requests_reservation_ids_gin_idx" ON "public"."reservation_payment_requests" USING gin ("reservation_ids");

CREATE OR REPLACE TRIGGER "reservation_payment_requests_touch_updated_at"
BEFORE UPDATE ON "public"."reservation_payment_requests"
FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();

ALTER TABLE "public"."reservation_payment_requests" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reservations payment requests are read by authenticated users with reservation permission"
  ON "public"."reservation_payment_requests" FOR SELECT TO "authenticated"
  USING ("public"."user_has_permission"("auth"."uid"(), 'read:reservation'::text));

CREATE POLICY "Reservations payment requests are created by users with reservation permission"
  ON "public"."reservation_payment_requests" FOR INSERT TO "authenticated"
  WITH CHECK ("public"."user_has_permission"("auth"."uid"(), 'create:reservation'::text));

CREATE POLICY "Reservations payment requests are updated by users with reservation permission"
  ON "public"."reservation_payment_requests" FOR UPDATE TO "authenticated"
  USING ("public"."user_has_permission"("auth"."uid"(), 'update:reservation'::text))
  WITH CHECK ("public"."user_has_permission"("auth"."uid"(), 'update:reservation'::text));

-- Store generated UPI payment requests for the admin Payments prototype.

CREATE TABLE IF NOT EXISTS "public"."payment_requests" (
    "id" uuid DEFAULT gen_random_uuid() NOT NULL,
    "identifier" text NOT NULL,
    "amount" numeric(12,2) NOT NULL,
    "paid_amount" numeric(12,2) NOT NULL DEFAULT 0,
    "status" text NOT NULL DEFAULT 'pending',
    "upi_id" text NOT NULL,
    "upi_merchant_name" text NOT NULL,
    "upi_uri" text NOT NULL,
    "requested_at" timestamptz NOT NULL DEFAULT now(),
    "expires_at" timestamptz NOT NULL DEFAULT (now() + interval '3 hours'),
    "paid_at" timestamptz,
    "payment_reference" text,
    "matched_transaction" jsonb,
    "notes" text,
    "created_by" uuid,
    "created_at" timestamptz NOT NULL DEFAULT now(),
    "updated_at" timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT "payment_requests_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "payment_requests_identifier_key" UNIQUE ("identifier"),
    CONSTRAINT "payment_requests_identifier_length" CHECK ("identifier" ~ '^[A-Z0-9]{5}$'),
    CONSTRAINT "payment_requests_amount_positive" CHECK ("amount" > 0),
    CONSTRAINT "payment_requests_paid_amount_non_negative" CHECK ("paid_amount" >= 0),
    CONSTRAINT "payment_requests_status_check" CHECK (
      "status" = ANY (
        ARRAY[
          'pending'::text,
          'paid'::text,
          'expired'::text,
          'cancelled'::text
        ]::text[]
      )
    ),
    CONSTRAINT "payment_requests_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "payment_requests_status_idx" ON "public"."payment_requests" USING btree ("status");
CREATE INDEX IF NOT EXISTS "payment_requests_expires_at_idx" ON "public"."payment_requests" USING btree ("expires_at");
CREATE INDEX IF NOT EXISTS "payment_requests_created_at_idx" ON "public"."payment_requests" USING btree ("created_at" DESC);

CREATE OR REPLACE TRIGGER "payment_requests_touch_updated_at"
BEFORE UPDATE ON "public"."payment_requests"
FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();

ALTER TABLE "public"."payment_requests" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Payment requests are read by users with payment permission"
  ON "public"."payment_requests" FOR SELECT TO "authenticated"
  USING ("public"."user_has_permission"("auth"."uid"(), 'read:payment'::text));

CREATE POLICY "Payment requests are created by users with payment permission"
  ON "public"."payment_requests" FOR INSERT TO "authenticated"
  WITH CHECK ("public"."user_has_permission"("auth"."uid"(), 'read:payment'::text));

CREATE POLICY "Payment requests are updated by users with payment permission"
  ON "public"."payment_requests" FOR UPDATE TO "authenticated"
  USING ("public"."user_has_permission"("auth"."uid"(), 'read:payment'::text))
  WITH CHECK ("public"."user_has_permission"("auth"."uid"(), 'read:payment'::text));

BEGIN;

SET search_path TO public;

ALTER TABLE "public"."payment_requests"
  ADD COLUMN IF NOT EXISTS "reservation_id" uuid,
  ADD COLUMN IF NOT EXISTS "folio_item_id" uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM "pg_constraint"
    WHERE "conname" = 'payment_requests_reservation_id_fkey'
  ) THEN
    ALTER TABLE "public"."payment_requests"
      ADD CONSTRAINT "payment_requests_reservation_id_fkey"
      FOREIGN KEY ("reservation_id")
      REFERENCES "public"."reservations"("id")
      ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM "pg_constraint"
    WHERE "conname" = 'payment_requests_folio_item_id_fkey'
  ) THEN
    ALTER TABLE "public"."payment_requests"
      ADD CONSTRAINT "payment_requests_folio_item_id_fkey"
      FOREIGN KEY ("folio_item_id")
      REFERENCES "public"."folio_items"("id")
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "payment_requests_reservation_id_idx"
  ON "public"."payment_requests" USING btree ("reservation_id")
  WHERE "reservation_id" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "payment_requests_folio_item_id_idx"
  ON "public"."payment_requests" USING btree ("folio_item_id")
  WHERE "folio_item_id" IS NOT NULL;

CREATE OR REPLACE FUNCTION "public"."mark_payment_request_paid"(
  "p_payment_request_id" uuid,
  "p_paid_amount" numeric DEFAULT NULL::numeric,
  "p_payment_reference" text DEFAULT NULL::text,
  "p_matched_transaction" jsonb DEFAULT NULL::jsonb
)
RETURNS "public"."payment_requests"
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request "public"."payment_requests"%ROWTYPE;
  v_updated_request "public"."payment_requests"%ROWTYPE;
  v_booking_id text;
  v_paid_amount numeric(12, 2);
  v_reference text;
  v_folio_item_id uuid;
BEGIN
  SELECT *
  INTO v_request
  FROM "public"."payment_requests"
  WHERE "id" = "p_payment_request_id"
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment request not found.'
      USING ERRCODE = 'P0002';
  END IF;

  IF v_request."status" = 'paid' THEN
    RETURN v_request;
  END IF;

  IF v_request."status" <> 'pending' THEN
    RAISE EXCEPTION 'Only pending payment requests can be marked paid.'
      USING ERRCODE = '22023';
  END IF;

  v_paid_amount := round(coalesce("p_paid_amount", v_request."amount")::numeric, 2);

  IF v_paid_amount <= 0 THEN
    RAISE EXCEPTION 'Paid amount must be greater than 0.'
      USING ERRCODE = '22023';
  END IF;

  IF v_paid_amount > v_request."amount" THEN
    RAISE EXCEPTION 'Paid amount cannot exceed requested amount.'
      USING ERRCODE = '22023';
  END IF;

  v_reference := nullif(trim(coalesce("p_payment_reference", '')), '');

  IF v_request."reservation_id" IS NOT NULL THEN
    SELECT "booking_id"
    INTO v_booking_id
    FROM "public"."reservations"
    WHERE "id" = v_request."reservation_id";

    IF v_booking_id IS NULL THEN
      RAISE EXCEPTION 'Linked reservation not found.'
        USING ERRCODE = 'P0002';
    END IF;

    INSERT INTO "public"."folio_items" (
      "reservation_id",
      "description",
      "amount",
      "payment_method",
      "transaction_id",
      "external_source",
      "external_reference",
      "external_metadata"
    )
    VALUES (
      v_request."reservation_id",
      'Payment - UPI Gateway',
      -v_paid_amount,
      'UPI Gateway',
      v_reference,
      'payment_request',
      v_request."identifier",
      jsonb_build_object(
        'paymentRequestId', v_request."id",
        'identifier', v_request."identifier",
        'matchedTransaction', coalesce("p_matched_transaction", '{}'::jsonb)
      )
    )
    ON CONFLICT ("reservation_id", "external_source", "external_reference")
    DO UPDATE SET
      "description" = EXCLUDED."description",
      "amount" = EXCLUDED."amount",
      "payment_method" = EXCLUDED."payment_method",
      "transaction_id" = coalesce(EXCLUDED."transaction_id", "public"."folio_items"."transaction_id"),
      "external_metadata" = EXCLUDED."external_metadata"
    RETURNING "id" INTO v_folio_item_id;

    UPDATE "public"."reservations"
    SET
      "status" = 'Confirmed',
      "hold_expires_at" = NULL
    WHERE "booking_id" = v_booking_id
      AND "status" = 'Room Hold';
  END IF;

  UPDATE "public"."payment_requests"
  SET
    "status" = 'paid',
    "paid_amount" = v_paid_amount,
    "paid_at" = now(),
    "payment_reference" = coalesce(v_reference, "payment_reference"),
    "matched_transaction" = coalesce("p_matched_transaction", "matched_transaction"),
    "folio_item_id" = coalesce(v_folio_item_id, "folio_item_id")
  WHERE "id" = v_request."id"
  RETURNING * INTO v_updated_request;

  RETURN v_updated_request;
END;
$$;

REVOKE ALL ON FUNCTION "public"."mark_payment_request_paid"(uuid, numeric, text, jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."mark_payment_request_paid"(uuid, numeric, text, jsonb) TO "service_role";

-- ROLLBACK:
-- REVOKE ALL ON FUNCTION "public"."mark_payment_request_paid"(uuid, numeric, text, jsonb) FROM "service_role";
-- DROP FUNCTION IF EXISTS "public"."mark_payment_request_paid"(uuid, numeric, text, jsonb);
-- DROP INDEX IF EXISTS "public"."payment_requests_folio_item_id_idx";
-- DROP INDEX IF EXISTS "public"."payment_requests_reservation_id_idx";
-- ALTER TABLE "public"."payment_requests" DROP CONSTRAINT IF EXISTS "payment_requests_folio_item_id_fkey";
-- ALTER TABLE "public"."payment_requests" DROP CONSTRAINT IF EXISTS "payment_requests_reservation_id_fkey";
-- ALTER TABLE "public"."payment_requests" DROP COLUMN IF EXISTS "folio_item_id";
-- ALTER TABLE "public"."payment_requests" DROP COLUMN IF EXISTS "reservation_id";

COMMIT;

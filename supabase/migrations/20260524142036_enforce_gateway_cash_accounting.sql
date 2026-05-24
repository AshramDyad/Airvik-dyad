BEGIN;

SET search_path TO public;

ALTER TABLE "public"."folio_items"
  ADD COLUMN IF NOT EXISTS "received_by" uuid,
  ADD COLUMN IF NOT EXISTS "received_at" timestamp with time zone;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM "pg_constraint"
    WHERE "conname" = 'folio_items_received_by_fkey'
  ) THEN
    ALTER TABLE "public"."folio_items"
      ADD CONSTRAINT "folio_items_received_by_fkey"
      FOREIGN KEY ("received_by")
      REFERENCES "public"."profiles"("id")
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "folio_items_payment_method_timestamp_idx"
  ON "public"."folio_items" USING btree ("payment_method", "timestamp" DESC);

CREATE INDEX IF NOT EXISTS "folio_items_received_by_timestamp_idx"
  ON "public"."folio_items" USING btree ("received_by", "timestamp" DESC)
  WHERE "received_by" IS NOT NULL;

UPDATE "public"."roles"
SET "permissions" = array_append(coalesce("permissions", ARRAY[]::text[]), 'read:payment')
WHERE "permissions" IS NOT NULL
  AND 'create:reservation' = ANY ("permissions")
  AND 'update:reservation' = ANY ("permissions")
  AND NOT ('read:payment' = ANY ("permissions"));

UPDATE "public"."roles"
SET "permissions" = array_append(coalesce("permissions", ARRAY[]::text[]), 'update:payment')
WHERE "name" IN ('Administration', 'Hotel Owner', 'Hotel Manager')
  AND NOT ('update:payment' = ANY (coalesce("permissions", ARRAY[]::text[])));

CREATE OR REPLACE FUNCTION "public"."enforce_gateway_confirmation_rules"()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW."payment_method" = 'UPI Gateway' THEN
    IF TG_OP = 'INSERT' AND NEW."status" <> 'Room Hold' THEN
      RAISE EXCEPTION 'UPI Gateway reservations must start as Room Hold.'
        USING ERRCODE = '23514';
    END IF;

    IF TG_OP = 'UPDATE' THEN
      IF NEW."status" IN ('Confirmed', 'Checked-in', 'Checked-out')
        AND (
          OLD."status" IS DISTINCT FROM NEW."status"
          OR OLD."payment_method" IS DISTINCT FROM NEW."payment_method"
        )
        AND NOT EXISTS (
          SELECT 1
          FROM "public"."folio_items" "fi"
          JOIN "public"."reservations" "linked"
            ON "linked"."id" = "fi"."reservation_id"
          WHERE "linked"."booking_id" = NEW."booking_id"
            AND "fi"."amount" < 0
            AND "fi"."payment_method" = 'UPI Gateway'
            AND "fi"."external_source" IN ('payment_request', 'payment_override')
        ) THEN
        RAISE EXCEPTION 'UPI Gateway reservations can be confirmed only after matched payment or admin override.'
          USING ERRCODE = '23514';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "reservations_enforce_gateway_confirmation_rules"
  ON "public"."reservations";

CREATE TRIGGER "reservations_enforce_gateway_confirmation_rules"
BEFORE INSERT OR UPDATE OF "status", "payment_method"
ON "public"."reservations"
FOR EACH ROW
EXECUTE FUNCTION "public"."enforce_gateway_confirmation_rules"();

CREATE OR REPLACE FUNCTION "public"."mark_payment_request_paid"(
  "p_payment_request_id" uuid,
  "p_paid_amount" numeric DEFAULT NULL::numeric,
  "p_payment_reference" text DEFAULT NULL::text,
  "p_matched_transaction" jsonb DEFAULT NULL::jsonb
)
RETURNS "public"."payment_requests"
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
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
      "external_metadata",
      "received_by",
      "received_at"
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
      ),
      v_request."created_by",
      now()
    )
    ON CONFLICT ("reservation_id", "external_source", "external_reference")
    DO UPDATE SET
      "description" = EXCLUDED."description",
      "amount" = EXCLUDED."amount",
      "payment_method" = EXCLUDED."payment_method",
      "transaction_id" = coalesce(EXCLUDED."transaction_id", "public"."folio_items"."transaction_id"),
      "external_metadata" = EXCLUDED."external_metadata",
      "received_by" = coalesce(EXCLUDED."received_by", "public"."folio_items"."received_by"),
      "received_at" = coalesce(EXCLUDED."received_at", "public"."folio_items"."received_at")
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

CREATE OR REPLACE FUNCTION "public"."admin_confirm_gateway_payment_override"(
  "p_reservation_id" uuid,
  "p_paid_amount" numeric,
  "p_payment_reference" text,
  "p_reason" text,
  "p_actor_user_id" uuid
)
RETURNS "public"."folio_items"
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_reservation "public"."reservations"%ROWTYPE;
  v_folio_item "public"."folio_items"%ROWTYPE;
  v_paid_amount numeric(12, 2);
  v_reference text;
  v_reason text;
BEGIN
  IF "p_actor_user_id" IS NULL
    OR NOT "public"."user_has_permission"("p_actor_user_id", 'update:payment') THEN
    RAISE EXCEPTION 'Only authorized admins can override payment confirmation.'
      USING ERRCODE = '42501';
  END IF;

  SELECT *
  INTO v_reservation
  FROM "public"."reservations"
  WHERE "id" = "p_reservation_id"
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reservation not found.'
      USING ERRCODE = 'P0002';
  END IF;

  IF v_reservation."payment_method" <> 'UPI Gateway' THEN
    RAISE EXCEPTION 'Only UPI Gateway reservations can use payment override.'
      USING ERRCODE = '22023';
  END IF;

  IF v_reservation."status" <> 'Room Hold' THEN
    RAISE EXCEPTION 'Only Room Hold reservations can be confirmed by payment override.'
      USING ERRCODE = '22023';
  END IF;

  v_paid_amount := round("p_paid_amount"::numeric, 2);
  IF v_paid_amount <= 0 THEN
    RAISE EXCEPTION 'Paid amount must be greater than 0.'
      USING ERRCODE = '22023';
  END IF;

  v_reference := nullif(trim(coalesce("p_payment_reference", '')), '');
  v_reason := nullif(trim(coalesce("p_reason", '')), '');

  IF v_reason IS NULL THEN
    RAISE EXCEPTION 'Override reason is required.'
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO "public"."folio_items" (
    "reservation_id",
    "description",
    "amount",
    "payment_method",
    "transaction_id",
    "external_source",
    "external_reference",
    "external_metadata",
    "received_by",
    "received_at"
  )
  VALUES (
    v_reservation."id",
    'Payment - UPI Gateway Override',
    -v_paid_amount,
    'UPI Gateway',
    v_reference,
    'payment_override',
    coalesce(v_reference, 'override-' || gen_random_uuid()::text),
    jsonb_build_object(
      'reason', v_reason,
      'actorUserId', "p_actor_user_id"
    ),
    "p_actor_user_id",
    now()
  )
  RETURNING * INTO v_folio_item;

  UPDATE "public"."reservations"
  SET
    "status" = 'Confirmed',
    "hold_expires_at" = NULL
  WHERE "booking_id" = v_reservation."booking_id"
    AND "status" = 'Room Hold';

  RETURN v_folio_item;
END;
$$;

REVOKE ALL ON FUNCTION "public"."admin_confirm_gateway_payment_override"(uuid, numeric, text, text, uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_confirm_gateway_payment_override"(uuid, numeric, text, text, uuid) TO "service_role";

CREATE OR REPLACE FUNCTION "public"."create_cash_reservations_with_total"(
  "p_booking_id" text,
  "p_guest_id" uuid,
  "p_room_ids" uuid[],
  "p_rate_plan_id" uuid,
  "p_check_in_date" date,
  "p_check_out_date" date,
  "p_number_of_guests" integer,
  "p_notes" text DEFAULT NULL::text,
  "p_booking_date" timestamp with time zone DEFAULT now(),
  "p_source" text DEFAULT 'reception'::text,
  "p_adult_count" integer DEFAULT 1,
  "p_child_count" integer DEFAULT 0,
  "p_tax_enabled_snapshot" boolean DEFAULT false,
  "p_tax_rate_snapshot" numeric DEFAULT 0,
  "p_custom_totals" numeric[] DEFAULT NULL::numeric[],
  "p_cash_amount" numeric DEFAULT NULL::numeric,
  "p_actor_user_id" uuid DEFAULT NULL::uuid
)
RETURNS SETOF "public"."reservations"
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_reservation "public"."reservations"%ROWTYPE;
  v_first_reservation_id uuid;
  v_cash_amount numeric(12, 2);
BEGIN
  IF "p_actor_user_id" IS NULL
    OR NOT "public"."user_has_permission"("p_actor_user_id", 'create:reservation')
    OR NOT "public"."user_has_permission"("p_actor_user_id", 'update:reservation') THEN
    RAISE EXCEPTION 'Insufficient permissions to create a cash reservation.'
      USING ERRCODE = '42501';
  END IF;

  v_cash_amount := round(coalesce("p_cash_amount", 0)::numeric, 2);
  IF v_cash_amount <= 0 THEN
    RAISE EXCEPTION 'Cash amount must be greater than 0.'
      USING ERRCODE = '22023';
  END IF;

  FOR v_reservation IN
    SELECT *
    FROM "public"."create_reservations_with_total"(
      "p_booking_id",
      "p_guest_id",
      "p_room_ids",
      "p_rate_plan_id",
      "p_check_in_date",
      "p_check_out_date",
      "p_number_of_guests",
      'Confirmed',
      "p_notes",
      "p_booking_date",
      "p_source",
      'Cash',
      "p_adult_count",
      "p_child_count",
      NULL::timestamp with time zone,
      "p_tax_enabled_snapshot",
      "p_tax_rate_snapshot",
      "p_custom_totals"
    )
  LOOP
    IF v_first_reservation_id IS NULL THEN
      v_first_reservation_id := v_reservation."id";
    END IF;

    RETURN NEXT v_reservation;
  END LOOP;

  IF v_first_reservation_id IS NULL THEN
    RAISE EXCEPTION 'Cash reservation could not be created.'
      USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO "public"."folio_items" (
    "reservation_id",
    "description",
    "amount",
    "payment_method",
    "external_source",
    "external_reference",
    "external_metadata",
    "received_by",
    "received_at"
  )
  VALUES (
    v_first_reservation_id,
    'Payment - Cash',
    -v_cash_amount,
    'Cash',
    'cash_payment',
    'cash-' || gen_random_uuid()::text,
    jsonb_build_object('actorUserId', "p_actor_user_id"),
    "p_actor_user_id",
    now()
  );
END;
$$;

REVOKE ALL ON FUNCTION "public"."create_cash_reservations_with_total"(text, uuid, uuid[], uuid, date, date, integer, text, timestamp with time zone, text, integer, integer, boolean, numeric, numeric[], numeric, uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_cash_reservations_with_total"(text, uuid, uuid[], uuid, date, date, integer, text, timestamp with time zone, text, integer, integer, boolean, numeric, numeric[], numeric, uuid) TO "service_role";

COMMIT;

-- ROLLBACK:
-- DROP FUNCTION IF EXISTS "public"."create_cash_reservations_with_total"(text, uuid, uuid[], uuid, date, date, integer, text, timestamp with time zone, text, integer, integer, boolean, numeric, numeric[], numeric, uuid);
-- DROP FUNCTION IF EXISTS "public"."admin_confirm_gateway_payment_override"(uuid, numeric, text, text, uuid);
-- DROP TRIGGER IF EXISTS "reservations_enforce_gateway_confirmation_rules" ON "public"."reservations";
-- DROP FUNCTION IF EXISTS "public"."enforce_gateway_confirmation_rules"();
-- RECREATE "public"."mark_payment_request_paid"(uuid, numeric, text, jsonb) FROM THE PREVIOUS MIGRATION IF NEEDED.
-- DROP INDEX IF EXISTS "public"."folio_items_received_by_timestamp_idx";
-- DROP INDEX IF EXISTS "public"."folio_items_payment_method_timestamp_idx";
-- ALTER TABLE "public"."folio_items" DROP CONSTRAINT IF EXISTS "folio_items_received_by_fkey";
-- ALTER TABLE "public"."folio_items" DROP COLUMN IF EXISTS "received_at";
-- ALTER TABLE "public"."folio_items" DROP COLUMN IF EXISTS "received_by";

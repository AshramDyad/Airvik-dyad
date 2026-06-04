-- Credit notes: store credit issued to a guest when a booking is cancelled.
-- A credit note can be at most the amount the guest actually paid for that
-- booking. It is later applied to a future booking as a "Credit Note" payment
-- (recorded as a negative folio item), so the existing balance / UPI / cash
-- flow collects whatever remains. This migration only ADDS a new table and a
-- new function; it does not change folio_items, reservations, guests, or any
-- existing RPC, so current behaviour is untouched.

BEGIN;

SET search_path TO public;

-- 1) Table -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "public"."credit_notes" (
    "id" uuid DEFAULT gen_random_uuid() NOT NULL,
    "guest_id" uuid NOT NULL,
    "source_booking_id" text NOT NULL,
    "original_amount" numeric(12,2) NOT NULL,
    "remaining_amount" numeric(12,2) NOT NULL,
    "status" text NOT NULL DEFAULT 'active',
    "notes" text,
    "created_by" uuid,
    "created_at" timestamptz NOT NULL DEFAULT now(),
    "updated_at" timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT "credit_notes_pkey" PRIMARY KEY ("id"),
    -- Only one credit note per cancelled booking. Also makes a double-click
    -- on "Issue Credit Note" impossible (the second insert fails).
    CONSTRAINT "credit_notes_source_booking_id_key" UNIQUE ("source_booking_id"),
    CONSTRAINT "credit_notes_original_amount_positive" CHECK ("original_amount" > 0),
    CONSTRAINT "credit_notes_remaining_amount_non_negative" CHECK ("remaining_amount" >= 0),
    CONSTRAINT "credit_notes_remaining_within_original" CHECK ("remaining_amount" <= "original_amount"),
    CONSTRAINT "credit_notes_status_check" CHECK (
      "status" = ANY (ARRAY['active'::text, 'redeemed'::text])
    ),
    CONSTRAINT "credit_notes_guest_id_fkey" FOREIGN KEY ("guest_id")
      REFERENCES "public"."guests"("id") ON DELETE RESTRICT,
    CONSTRAINT "credit_notes_created_by_fkey" FOREIGN KEY ("created_by")
      REFERENCES "public"."profiles"("id") ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "credit_notes_guest_id_idx" ON "public"."credit_notes" USING btree ("guest_id");
CREATE INDEX IF NOT EXISTS "credit_notes_status_idx" ON "public"."credit_notes" USING btree ("status");

CREATE OR REPLACE TRIGGER "credit_notes_touch_updated_at"
BEFORE UPDATE ON "public"."credit_notes"
FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();

-- 2) RLS ---------------------------------------------------------------------
-- Reads are allowed for staff with payment permission. There are deliberately
-- NO insert/update policies: all writes go through the service-role API routes
-- and the SECURITY DEFINER function below, so clients cannot change credit
-- directly.
ALTER TABLE "public"."credit_notes" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Credit notes are read by users with payment permission"
  ON "public"."credit_notes" FOR SELECT TO "authenticated"
  USING ("public"."user_has_permission"("auth"."uid"(), 'read:payment'::text));

-- 3) Redemption RPC ----------------------------------------------------------
-- Applying a credit note does TWO writes that must both succeed or both fail:
--   (a) decrement the credit note's remaining_amount, and
--   (b) insert a negative folio item (the "Credit Note" payment).
-- Doing them separately could decrement and then fail the insert, losing the
-- guest's money, so they live in one transaction here. This mirrors the
-- existing record_cash_payment_with_balance_guard function.
CREATE OR REPLACE FUNCTION "public"."redeem_credit_note_with_balance_guard"(
  "p_credit_note_id" uuid,
  "p_reservation_id" uuid,
  "p_amount" numeric,
  "p_actor_user_id" uuid
)
RETURNS "public"."folio_items"
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_reservation "public"."reservations"%ROWTYPE;
  v_credit_note "public"."credit_notes"%ROWTYPE;
  v_folio_item "public"."folio_items"%ROWTYPE;
  v_amount numeric(12, 2);
  v_room_charges numeric(12, 2);
  v_additional_charges numeric(12, 2);
  v_taxes_and_fees numeric(12, 2);
  v_total_paid numeric(12, 2);
  v_balance numeric(12, 2);
  v_reservation_ids uuid[];
BEGIN
  -- Same permission gate as cash payments.
  IF "p_actor_user_id" IS NULL
    OR NOT "public"."user_has_permission"("p_actor_user_id", 'update:reservation') THEN
    RAISE EXCEPTION 'Insufficient permissions to redeem credit note.'
      USING ERRCODE = '42501';
  END IF;

  v_amount := round(coalesce("p_amount", 0)::numeric, 2);
  IF v_amount <= 0 THEN
    RAISE EXCEPTION 'Credit amount must be greater than 0.'
      USING ERRCODE = '22023';
  END IF;

  SELECT *
  INTO v_reservation
  FROM "public"."reservations"
  WHERE "id" = "p_reservation_id";

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reservation not found.'
      USING ERRCODE = 'P0002';
  END IF;

  -- Lock the credit note row so concurrent redemptions cannot both spend it.
  SELECT *
  INTO v_credit_note
  FROM "public"."credit_notes"
  WHERE "id" = "p_credit_note_id"
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Credit note not found.'
      USING ERRCODE = 'P0002';
  END IF;

  -- A credit note can only pay for a booking belonging to the same guest.
  IF v_credit_note."guest_id" <> v_reservation."guest_id" THEN
    RAISE EXCEPTION 'Credit note belongs to a different guest.'
      USING ERRCODE = '22023';
  END IF;

  IF v_credit_note."remaining_amount" < v_amount THEN
    RAISE EXCEPTION 'Insufficient credit note balance.'
      USING ERRCODE = '22023';
  END IF;

  -- Lock every live reservation in this booking and total the charges/payments.
  -- Here the Cancelled/No-show filter IS correct: we are paying a live booking.
  SELECT array_agg("locked_reservations"."id" ORDER BY "locked_reservations"."id")
  INTO v_reservation_ids
  FROM (
    SELECT "id"
    FROM "public"."reservations"
    WHERE "booking_id" = v_reservation."booking_id"
      AND "status" NOT IN ('Cancelled', 'No-show')
      AND (
        "external_metadata" IS NULL
        OR "external_metadata" ->> 'removedDuringEdit' IS NULL
        OR "external_metadata" ->> 'removedDuringEdit' <> 'true'
      )
    ORDER BY "id"
    FOR UPDATE
  ) AS "locked_reservations";

  IF v_reservation_ids IS NULL OR array_length(v_reservation_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'Reservation not found.'
      USING ERRCODE = 'P0002';
  END IF;

  SELECT
    round(coalesce(sum("total_amount"), 0)::numeric, 2),
    round(coalesce(sum(
      CASE
        WHEN "tax_enabled_snapshot" THEN "total_amount" * coalesce("tax_rate_snapshot", 0)
        ELSE 0
      END
    ), 0)::numeric, 2)
  INTO v_room_charges, v_taxes_and_fees
  FROM "public"."reservations"
  WHERE "id" = ANY(v_reservation_ids);

  SELECT
    round(coalesce(sum(CASE WHEN "amount" > 0 THEN "amount" ELSE 0 END), 0)::numeric, 2),
    round(coalesce(sum(CASE WHEN "amount" < 0 THEN abs("amount") ELSE 0 END), 0)::numeric, 2)
  INTO v_additional_charges, v_total_paid
  FROM "public"."folio_items"
  WHERE "reservation_id" = ANY(v_reservation_ids);

  v_balance := round(
    coalesce(v_room_charges, 0)
    + coalesce(v_taxes_and_fees, 0)
    + coalesce(v_additional_charges, 0)
    - coalesce(v_total_paid, 0),
    2
  );

  IF v_balance <= 0 THEN
    RAISE EXCEPTION 'This reservation is already fully paid.'
      USING ERRCODE = '22023';
  END IF;

  -- Do not let credit exceed what is owed (no overpayment / negative balance).
  IF v_amount > v_balance THEN
    RAISE EXCEPTION 'Amount exceeds the outstanding balance.'
      USING ERRCODE = '22023';
  END IF;

  -- (a) Spend the credit. The row is already locked above.
  UPDATE "public"."credit_notes"
  SET
    "remaining_amount" = "remaining_amount" - v_amount,
    "status" = CASE
      WHEN "remaining_amount" - v_amount = 0 THEN 'redeemed'
      ELSE 'active'
    END
  WHERE "id" = "p_credit_note_id";

  -- (b) Record the payment as a negative folio item on this reservation.
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
    v_reservation."id",
    'Payment - Credit Note',
    -v_amount,
    'Credit Note',
    'credit_redemption',
    'creditnote-' || gen_random_uuid()::text,
    jsonb_build_object(
      'creditNoteId', "p_credit_note_id",
      'actorUserId', "p_actor_user_id"
    ),
    "p_actor_user_id",
    now()
  )
  RETURNING * INTO v_folio_item;

  RETURN v_folio_item;
END;
$$;

REVOKE ALL ON FUNCTION "public"."redeem_credit_note_with_balance_guard"(uuid, uuid, numeric, uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."redeem_credit_note_with_balance_guard"(uuid, uuid, numeric, uuid) TO "service_role";

COMMIT;

-- ROLLBACK:
-- DROP FUNCTION IF EXISTS "public"."redeem_credit_note_with_balance_guard"(uuid, uuid, numeric, uuid);
-- DROP TABLE IF EXISTS "public"."credit_notes";

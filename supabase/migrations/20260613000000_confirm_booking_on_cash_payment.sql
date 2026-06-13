BEGIN;

SET search_path TO public;

-- A reception booking made as "UPI Gateway" starts in "Room Hold". If the guest
-- pays cash instead (QR expired/unused), recording that cash must confirm the
-- room — exactly like the UPI-Gateway flow confirms on any matched amount
-- (see mark_payment_request_paid). Until now the cash function only inserted a
-- folio payment and left the booking stuck on hold.
--
-- This re-creates record_cash_payment_with_balance_guard with the same signature
-- and behaviour, adding one confirm step after the folio insert. Switching the
-- reservation's payment_method to 'Cash' reflects the real payment AND makes the
-- enforce_gateway_confirmation_rules trigger's `payment_method = 'UPI Gateway'`
-- guard false, so that trigger is bypassed by design — no trigger change needed.
CREATE OR REPLACE FUNCTION "public"."record_cash_payment_with_balance_guard"(
  "p_reservation_id" uuid,
  "p_paid_amount" numeric,
  "p_actor_user_id" uuid,
  "p_notes" text DEFAULT NULL
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
  v_room_charges numeric(12, 2);
  v_additional_charges numeric(12, 2);
  v_taxes_and_fees numeric(12, 2);
  v_total_paid numeric(12, 2);
  v_balance numeric(12, 2);
  v_reservation_ids uuid[];
  v_notes text;
  v_description text;
  v_metadata jsonb;
BEGIN
  IF "p_actor_user_id" IS NULL
    OR NOT "public"."user_has_permission"("p_actor_user_id", 'update:reservation') THEN
    RAISE EXCEPTION 'Insufficient permissions to record cash payment.'
      USING ERRCODE = '42501';
  END IF;

  v_paid_amount := round(coalesce("p_paid_amount", 0)::numeric, 2);
  IF v_paid_amount <= 0 THEN
    RAISE EXCEPTION 'Cash amount must be greater than 0.'
      USING ERRCODE = '22023';
  END IF;

  v_notes := nullif(btrim(coalesce("p_notes", '')), '');

  SELECT *
  INTO v_reservation
  FROM "public"."reservations"
  WHERE "id" = "p_reservation_id";

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reservation not found.'
      USING ERRCODE = 'P0002';
  END IF;

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

  IF v_paid_amount > v_balance THEN
    RAISE EXCEPTION 'Amount exceeds the outstanding balance.'
      USING ERRCODE = '22023';
  END IF;

  v_description := 'Payment - Cash';
  v_metadata := jsonb_build_object('actorUserId', "p_actor_user_id");
  IF v_notes IS NOT NULL THEN
    v_description := v_description || ' — ' || v_notes;
    v_metadata := v_metadata || jsonb_build_object('notes', v_notes);
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
    v_reservation."id",
    v_description,
    -v_paid_amount,
    'Cash',
    'cash_payment',
    'cash-' || gen_random_uuid()::text,
    v_metadata,
    "p_actor_user_id",
    now()
  )
  RETURNING * INTO v_folio_item;

  -- Cash settles the hold: confirm the booking and reflect the real payment
  -- method. Mirrors the UPI-Gateway confirm step; switching to 'Cash' bypasses
  -- the enforce_gateway_confirmation_rules trigger by design. Conditional on
  -- status so Confirmed/Checked-in/Checked-out rows are left untouched (and the
  -- step is safe to re-run).
  UPDATE "public"."reservations"
  SET
    "status" = 'Confirmed',
    "payment_method" = 'Cash',
    "hold_expires_at" = NULL
  WHERE "id" = ANY(v_reservation_ids)
    AND "status" IN ('Room Hold', 'Pending');

  RETURN v_folio_item;
END;
$$;

REVOKE ALL ON FUNCTION "public"."record_cash_payment_with_balance_guard"(uuid, numeric, uuid, text) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."record_cash_payment_with_balance_guard"(uuid, numeric, uuid, text) TO "service_role";

-- One-time backfill: existing bookings that were paid in cash but left stuck in
-- "Room Hold" (the bug this migration fixes). The fully-paid ones cannot be
-- re-paid through the function (the "already fully paid" guard blocks them), so
-- they are corrected directly here. Criteria-based so it matches exactly the
-- affected rows with no hard-coded booking ids.
UPDATE "public"."reservations" r
SET
  "status" = 'Confirmed',
  "payment_method" = 'Cash',
  "hold_expires_at" = NULL
WHERE r."status" = 'Room Hold'
  AND r."payment_method" = 'UPI Gateway'
  AND EXISTS (
    SELECT 1
    FROM "public"."folio_items" f
    WHERE f."reservation_id" = r."id"
      AND f."amount" < 0
      AND f."external_source" = 'cash_payment'
  );

COMMIT;

-- ROLLBACK:
-- (Re-create the function from 20260603131355_allow_cash_payment_on_gateway_with_notes.sql
--  to drop the confirm step. The backfilled reservations stay Confirmed.)

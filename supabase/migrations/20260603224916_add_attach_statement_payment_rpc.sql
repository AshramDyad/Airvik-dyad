SET search_path TO public;

-- Records an incoming bank/UPI statement transaction as a UPI Gateway payment on a
-- known booking. Used from the Payments statement page when a transaction did NOT
-- auto-match. Modelled on admin_confirm_gateway_payment_override, but:
--   * works on a UPI Gateway booking in ANY status (not just Room Hold), because one
--     booking can take many payments and later transfers land on already-Confirmed
--     bookings;
--   * de-duplicates on the transaction reference so the SAME transaction cannot be
--     attached twice (a booking may still receive many DIFFERENT transactions);
--   * inserts the folio with external_source = 'payment_override' so the existing
--     enforce_gateway_confirmation_rules trigger accepts the Room Hold -> Confirmed flip;
--   * confirms the booking only when it is still on Room Hold.

CREATE OR REPLACE FUNCTION "public"."admin_attach_statement_payment"(
  "p_reservation_id" uuid,
  "p_paid_amount" numeric,
  "p_payment_reference" text,
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
BEGIN
  IF "p_actor_user_id" IS NULL
    OR NOT "public"."user_has_permission"("p_actor_user_id", 'update:payment') THEN
    RAISE EXCEPTION 'Only authorized admins can attach a statement payment.'
      USING ERRCODE = '42501';
  END IF;

  v_reference := nullif(btrim(coalesce("p_payment_reference", '')), '');
  IF v_reference IS NULL THEN
    RAISE EXCEPTION 'A transaction reference is required to attach a payment.'
      USING ERRCODE = '22023';
  END IF;

  SELECT *
  INTO v_reservation
  FROM "public"."reservations"
  WHERE "id" = "p_reservation_id"
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found.'
      USING ERRCODE = 'P0002';
  END IF;

  IF v_reservation."payment_method" <> 'UPI Gateway' THEN
    RAISE EXCEPTION 'Only UPI Gateway bookings can have a statement payment attached.'
      USING ERRCODE = '22023';
  END IF;

  v_paid_amount := round("p_paid_amount"::numeric, 2);
  IF v_paid_amount <= 0 THEN
    RAISE EXCEPTION 'Paid amount must be greater than 0.'
      USING ERRCODE = '22023';
  END IF;

  -- Same transaction can only be attached once (a booking may still hold many
  -- different transactions, auto-matched or manually attached).
  IF EXISTS (
    SELECT 1
    FROM "public"."folio_items" "fi"
    WHERE lower(btrim("fi"."transaction_id")) = lower(v_reference)
      AND "fi"."payment_method" = 'UPI Gateway'
      AND "fi"."external_source" IN ('payment_request', 'payment_override')
  ) THEN
    RAISE EXCEPTION 'This transaction is already attached to a booking.'
      USING ERRCODE = '23505';
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
    'Payment - UPI Gateway (statement)',
    -v_paid_amount,
    'UPI Gateway',
    v_reference,
    'payment_override',
    v_reference,
    jsonb_build_object(
      'source', 'statement_attach',
      'actorUserId', "p_actor_user_id"
    ),
    "p_actor_user_id",
    now()
  )
  RETURNING * INTO v_folio_item;

  -- First payment confirms a booking that is still waiting on Room Hold.
  UPDATE "public"."reservations"
  SET
    "status" = 'Confirmed',
    "hold_expires_at" = NULL
  WHERE "booking_id" = v_reservation."booking_id"
    AND "status" = 'Room Hold';

  RETURN v_folio_item;
END;
$$;

REVOKE ALL ON FUNCTION "public"."admin_attach_statement_payment"(uuid, numeric, text, uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_attach_statement_payment"(uuid, numeric, text, uuid) TO "service_role";

-- ROLLBACK:
-- DROP FUNCTION IF EXISTS "public"."admin_attach_statement_payment"(uuid, numeric, text, uuid);

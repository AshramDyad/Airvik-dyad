SET search_path TO public;

-- Broadens admin_attach_statement_payment so an admin can attach a bank/UPI statement
-- transaction to ANY live booking (not only ones already on payment_method = 'UPI Gateway').
-- Website bookings are created with payment_method = 'UPI' and status = 'Pending', so the old
-- guard blocked attaching to them after a manual payment. Changes versus the previous version:
--   * the only status guard is Cancelled/No-show (those stay blocked so we never revive a dead
--     booking); any other status and any payment method are accepted;
--   * the folio line is recorded as a normal auto-confirmed gateway payment
--     ('Payment - UPI Gateway') instead of the '... (statement)' wording, while keeping the
--     'statement_attach' marker in external_metadata for audit;
--   * on attach the booking is switched to payment_method = 'UPI Gateway' and a Pending/Room Hold
--     booking is advanced to Confirmed (Confirmed/Checked-in/Checked-out keep their status).
-- The folio is inserted BEFORE the reservation UPDATE so enforce_gateway_confirmation_rules sees
-- an existing negative gateway payment and allows the status/method change.

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

  -- A payment can be attached to any live booking, but never to a dead one.
  IF v_reservation."status" IN ('Cancelled', 'No-show') THEN
    RAISE EXCEPTION 'Cannot attach a payment to a Cancelled or No-show booking.'
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

  -- Recorded as a normal auto-confirmed gateway payment; the 'statement_attach' marker in
  -- external_metadata keeps an audit trail without showing in the UI.
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
    'Payment - UPI Gateway',
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

  -- Treat the booking as gateway-paid and confirm it if it was still waiting. Scoped by
  -- booking_id so all live rooms of a multi-room booking move together; Cancelled/No-show
  -- sibling rooms are left untouched.
  UPDATE "public"."reservations"
  SET
    "payment_method" = 'UPI Gateway',
    "status" = CASE
      WHEN "status" IN ('Pending', 'Room Hold') THEN 'Confirmed'
      ELSE "status"
    END,
    "hold_expires_at" = NULL
  WHERE "booking_id" = v_reservation."booking_id"
    AND "status" NOT IN ('Cancelled', 'No-show');

  RETURN v_folio_item;
END;
$$;

REVOKE ALL ON FUNCTION "public"."admin_attach_statement_payment"(uuid, numeric, text, uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_attach_statement_payment"(uuid, numeric, text, uuid) TO "service_role";

-- ROLLBACK:
-- Re-create "public"."admin_attach_statement_payment"(uuid, numeric, text, uuid) from
-- migration 20260603224916_add_attach_statement_payment_rpc.sql (the prior body: it rejected any
-- booking whose payment_method <> 'UPI Gateway', recorded 'Payment - UPI Gateway (statement)', and
-- only confirmed Room Hold bookings without changing payment_method).

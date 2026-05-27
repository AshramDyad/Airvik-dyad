BEGIN;

SET search_path TO public;

CREATE OR REPLACE FUNCTION "public"."record_cash_payment_with_balance_guard"(
  "p_reservation_id" uuid,
  "p_paid_amount" numeric,
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
  v_room_charges numeric(12, 2);
  v_additional_charges numeric(12, 2);
  v_taxes_and_fees numeric(12, 2);
  v_total_paid numeric(12, 2);
  v_balance numeric(12, 2);
  v_reservation_ids uuid[];
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

  SELECT *
  INTO v_reservation
  FROM "public"."reservations"
  WHERE "id" = "p_reservation_id";

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reservation not found.'
      USING ERRCODE = 'P0002';
  END IF;

  IF v_reservation."payment_method" = 'UPI Gateway' THEN
    RAISE EXCEPTION 'UPI Gateway reservations must be paid through the linked QR or admin override.'
      USING ERRCODE = '22023';
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
    'Payment - Cash',
    -v_paid_amount,
    'Cash',
    'cash_payment',
    'cash-' || gen_random_uuid()::text,
    jsonb_build_object('actorUserId', "p_actor_user_id"),
    "p_actor_user_id",
    now()
  )
  RETURNING * INTO v_folio_item;

  RETURN v_folio_item;
END;
$$;

REVOKE ALL ON FUNCTION "public"."record_cash_payment_with_balance_guard"(uuid, numeric, uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."record_cash_payment_with_balance_guard"(uuid, numeric, uuid) TO "service_role";

COMMIT;

-- ROLLBACK:
-- DROP FUNCTION IF EXISTS "public"."record_cash_payment_with_balance_guard"(uuid, numeric, uuid);

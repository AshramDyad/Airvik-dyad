BEGIN;
SET search_path TO public;

-- Preserve existing blank notes when the edit does not change them.
CREATE OR REPLACE FUNCTION "public"."save_booking_edit"(
  "p_reservation_id" uuid, "p_actor_user_id" uuid, "p_expected" jsonb, "p_plan" jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp SET lock_timeout = '5s' AS $$
DECLARE
  v_primary "public"."reservations"%ROWTYPE;
  v_booking_id text;
  v_current_snapshot jsonb;
  v_expected_snapshot jsonb;
  v_before jsonb;
  v_assignments jsonb;
  v_active_ids uuid[];
  v_assigned_ids uuid[];
  v_cancel_ids uuid[];
  v_room_ids uuid[];
  v_new_room_ids uuid[];
  v_new_totals numeric[];
  v_created_ids uuid[] := ARRAY[]::uuid[];
  v_changed_ids uuid[] := ARRAY[]::uuid[];
  v_survivor uuid;
  v_check_in date;
  v_check_out date;
  v_rate_plan uuid;
  v_notes text;
  v_tax_enabled boolean;
  v_tax_rate numeric;
  v_adults integer;
  v_children integer;
  v_lock_key bigint;
  v_row record;
  v_validation json;
  v_result jsonb;
BEGIN
  IF "p_actor_user_id" IS NULL OR NOT "public"."user_has_permission"("p_actor_user_id", 'update:reservation') THEN
    RAISE EXCEPTION 'Insufficient permissions' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_primary FROM "public"."reservations" WHERE "id" = "p_reservation_id";
  IF NOT FOUND THEN RAISE EXCEPTION 'Booking not found.' USING ERRCODE = 'P0002'; END IF;
  v_booking_id := v_primary."booking_id";
  PERFORM "id" FROM "public"."reservations" WHERE "booking_id" = v_booking_id ORDER BY "id" FOR UPDATE;
  SELECT * INTO v_primary FROM "public"."reservations"
  WHERE "id" = ("p_plan"->>'primaryReservationId')::uuid AND "booking_id" = v_booking_id AND "status" NOT IN ('Cancelled', 'No-show');
  IF NOT FOUND OR "p_plan"->>'bookingId' IS DISTINCT FROM v_booking_id THEN
    RAISE EXCEPTION 'This booking changed. Reload it before saving.' USING ERRCODE = 'PT409';
  END IF;
  IF coalesce(jsonb_typeof("p_expected"), '') <> 'array' OR coalesce(jsonb_typeof("p_plan"->'assignments'), '') <> 'array' THEN
    RAISE EXCEPTION 'Invalid booking values.' USING ERRCODE = '22023';
  END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', r."id", 'roomId', r."room_id", 'ratePlanId', r."rate_plan_id", 'checkInDate', r."check_in_date", 'checkOutDate', r."check_out_date",
    'adultCount', coalesce(r."adult_count", r."number_of_guests"), 'childCount', coalesce(r."child_count", 0), 'numberOfGuests', r."number_of_guests",
    'notes', r."notes", 'totalAmount', r."total_amount", 'taxEnabledSnapshot', coalesce(r."tax_enabled_snapshot", false), 'taxRateSnapshot', coalesce(r."tax_rate_snapshot", 0),
    'status', r."status", 'paymentMethod', coalesce(r."payment_method", 'Not specified')
  ) ORDER BY r."id"), '[]'::jsonb), array_agg(r."id" ORDER BY r."id") INTO v_current_snapshot, v_active_ids
  FROM "public"."reservations" r WHERE r."booking_id" = v_booking_id AND r."status" NOT IN ('Cancelled', 'No-show');
  SELECT jsonb_agg(value ORDER BY (value->>'id')::uuid) INTO v_expected_snapshot FROM jsonb_array_elements("p_expected");
  -- Do not use serialization_failure (40001) for business conflicts: PostgREST
  -- 14 retries that code indefinitely. PT409 returns a non-retryable conflict.
  IF v_current_snapshot IS DISTINCT FROM v_expected_snapshot THEN RAISE EXCEPTION 'This booking changed. Reload it before saving.' USING ERRCODE = 'PT409'; END IF;
  SELECT jsonb_agg(to_jsonb(r) ORDER BY r."id") INTO v_before FROM "public"."reservations" r WHERE r."booking_id" = v_booking_id;
  v_assignments := "p_plan"->'assignments';
  v_check_in := ("p_plan"->>'checkInDate')::date;
  v_check_out := ("p_plan"->>'checkOutDate')::date;
  v_rate_plan := ("p_plan"->>'ratePlanId')::uuid;
  v_notes := nullif(btrim("p_plan"->>'notes'), '');
  v_tax_enabled := ("p_plan"->>'taxEnabledSnapshot')::boolean;
  v_tax_rate := ("p_plan"->>'taxRateSnapshot')::numeric;
  v_adults := ("p_plan"->>'adultCount')::integer;
  v_children := ("p_plan"->>'childCount')::integer;
  SELECT coalesce(array_agg(value::uuid ORDER BY value::uuid), ARRAY[]::uuid[]) INTO v_cancel_ids FROM jsonb_array_elements_text("p_plan"->'cancelIds');
  SELECT array_agg((value->>'roomId')::uuid ORDER BY ordinality), coalesce(array_agg((value->>'reservationId')::uuid ORDER BY (value->>'reservationId')::uuid) FILTER (WHERE value->>'reservationId' IS NOT NULL), ARRAY[]::uuid[])
  INTO v_room_ids, v_assigned_ids
  FROM jsonb_array_elements(v_assignments) WITH ORDINALITY;
  IF v_check_in IS NULL OR v_check_out IS NULL OR v_check_out <= v_check_in OR v_adults IS NULL OR v_children IS NULL OR v_adults < 0 OR v_children < 0 OR v_adults + v_children <= 0
    OR v_rate_plan IS NULL OR length(v_notes) > 500 OR coalesce(array_length(v_room_ids, 1), 0) = 0 THEN
    RAISE EXCEPTION 'Invalid booking values.' USING ERRCODE = '22023';
  END IF;
  IF (SELECT count(DISTINCT id) FROM unnest(v_room_ids) id) <> cardinality(v_room_ids)
    OR (SELECT array_agg(id ORDER BY id) FROM unnest(v_assigned_ids || v_cancel_ids) id) IS DISTINCT FROM v_active_ids THEN
    RAISE EXCEPTION 'Reservation assignments do not match this booking.' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_to_recordset(v_assignments) AS a("adultCount" integer, "childCount" integer, "numberOfGuests" integer, "totalAmount" numeric)
    WHERE a."adultCount" IS NULL OR a."childCount" IS NULL OR a."adultCount" < 0 OR a."childCount" < 0 OR a."numberOfGuests" IS DISTINCT FROM a."adultCount" + a."childCount" OR a."totalAmount" IS NULL OR a."totalAmount" <= 0)
    OR (SELECT sum(a."adultCount") FROM jsonb_to_recordset(v_assignments) AS a("adultCount" integer)) IS DISTINCT FROM v_adults::bigint
    OR (SELECT sum(a."childCount") FROM jsonb_to_recordset(v_assignments) AS a("childCount" integer)) IS DISTINCT FROM v_children::bigint THEN
    RAISE EXCEPTION 'Invalid room guest counts or prices.' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_to_recordset(v_assignments) AS a("reservationId" uuid) WHERE a."reservationId" IS NULL)
    AND NOT "public"."user_has_permission"("p_actor_user_id", 'create:reservation') THEN
    RAISE EXCEPTION 'Creating additional rooms requires reservation create permission.' USING ERRCODE = '42501';
  END IF;
  FOR v_lock_key IN
    SELECT DISTINCT pg_catalog.hashtextextended('reservation-room:' || id::text, 0)
    FROM (SELECT unnest(v_room_ids) AS id UNION SELECT "room_id" FROM "public"."reservations" WHERE "booking_id" = v_booking_id) rooms WHERE id IS NOT NULL ORDER BY 1
  LOOP PERFORM pg_catalog.pg_advisory_xact_lock(v_lock_key); END LOOP;
  IF (SELECT count(*) FROM "public"."rooms" WHERE "id" = ANY(v_room_ids)) <> cardinality(v_room_ids)
    OR EXISTS (SELECT 1 FROM "public"."rooms" rm WHERE rm."id" = ANY(v_room_ids) AND rm."status" NOT IN ('Clean', 'Dirty', 'Inspected')
      AND NOT EXISTS (SELECT 1 FROM "public"."reservations" r WHERE r."booking_id" = v_booking_id AND r."room_id" = rm."id" AND r."status" NOT IN ('Cancelled', 'No-show'))) THEN
    RAISE EXCEPTION 'A selected room is not available for booking.' USING ERRCODE = '23P01';
  END IF;
  IF coalesce((SELECT sum(rt."max_occupancy") FROM "public"."rooms" rm JOIN "public"."room_types" rt ON rt."id" = rm."room_type_id" WHERE rm."id" = ANY(v_room_ids)), 0) < v_adults + v_children THEN
    RAISE EXCEPTION 'Selected rooms cannot accommodate this guest count.' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM "public"."reservations" r WHERE r."room_id" = ANY(v_room_ids) AND r."booking_id" <> v_booking_id
    AND r."status" NOT IN ('Cancelled', 'No-show') AND daterange(r."check_in_date", r."check_out_date", '[)') && daterange(v_check_in, v_check_out, '[)')) THEN
    RAISE EXCEPTION 'One or more rooms are already booked for the selected dates.' USING ERRCODE = '23P01';
  END IF;
  FOR v_row IN SELECT * FROM jsonb_to_recordset(v_assignments) AS a("roomId" uuid, "adultCount" integer, "childCount" integer) LOOP
    v_validation := "public"."validate_booking_request"(v_check_in, v_check_out, v_row."roomId", v_row."adultCount", v_row."childCount");
    IF NOT coalesce((v_validation->>'isValid')::boolean, false) THEN RAISE EXCEPTION '%', coalesce(v_validation->>'message', 'Invalid stay dates.') USING ERRCODE = '22023'; END IF;
  END LOOP;
  UPDATE "public"."reservations" SET "status" = 'Cancelled', "external_metadata" = coalesce("external_metadata", '{}'::jsonb) || jsonb_build_object('removedDuringEdit', true, 'removedAt', now())
  WHERE "id" = ANY(v_cancel_ids) AND "booking_id" = v_booking_id;
  v_changed_ids := v_cancel_ids;
  FOR v_row IN
    WITH desired AS (SELECT * FROM jsonb_to_recordset(v_assignments) AS a("reservationId" uuid, "roomId" uuid, "adultCount" integer, "childCount" integer, "numberOfGuests" integer, "totalAmount" numeric))
    UPDATE "public"."reservations" r SET "room_id" = a."roomId", "check_in_date" = v_check_in, "check_out_date" = v_check_out, "adult_count" = a."adultCount", "child_count" = a."childCount",
      "number_of_guests" = a."numberOfGuests", "notes" = CASE WHEN v_notes IS NULL AND r."notes" ~ '^[[:space:]]*$' THEN r."notes" ELSE v_notes END, "total_amount" = a."totalAmount", "tax_enabled_snapshot" = v_tax_enabled, "tax_rate_snapshot" = v_tax_rate,
      "rate_plan_id" = CASE WHEN v_primary."rate_plan_id" IS NULL THEN v_rate_plan ELSE r."rate_plan_id" END
    FROM desired a WHERE r."id" = a."reservationId" AND r."booking_id" = v_booking_id AND
      ROW(r."room_id", r."check_in_date", r."check_out_date", r."adult_count", r."child_count", r."number_of_guests", r."notes", r."total_amount", r."tax_enabled_snapshot", r."tax_rate_snapshot", r."rate_plan_id")
      IS DISTINCT FROM ROW(a."roomId", v_check_in, v_check_out, a."adultCount", a."childCount", a."numberOfGuests", CASE WHEN v_notes IS NULL AND r."notes" ~ '^[[:space:]]*$' THEN r."notes" ELSE v_notes END, a."totalAmount", v_tax_enabled, v_tax_rate, CASE WHEN v_primary."rate_plan_id" IS NULL THEN v_rate_plan ELSE r."rate_plan_id" END)
    RETURNING r."id"
  LOOP v_changed_ids := array_append(v_changed_ids, v_row."id"); END LOOP;
  SELECT array_agg((value->>'roomId')::uuid ORDER BY ordinality), array_agg((value->>'totalAmount')::numeric ORDER BY ordinality)
  INTO v_new_room_ids, v_new_totals FROM jsonb_array_elements(v_assignments) WITH ORDINALITY WHERE value->>'reservationId' IS NULL;
  IF coalesce(cardinality(v_new_room_ids), 0) > 0 THEN
    FOR v_row IN SELECT * FROM "public"."create_reservations_with_total"(
      v_booking_id, v_primary."guest_id", v_new_room_ids, v_rate_plan, v_check_in, v_check_out, v_adults + v_children,
      "p_plan"->>'newRoomStatus', v_notes, v_primary."booking_date", v_primary."source", v_primary."payment_method", v_adults, v_children, NULL, v_tax_enabled, v_tax_rate, v_new_totals
    ) LOOP v_created_ids := array_append(v_created_ids, v_row."id"); END LOOP;
    UPDATE "public"."reservations" r SET "adult_count" = a."adultCount", "child_count" = a."childCount", "number_of_guests" = a."numberOfGuests"
    FROM jsonb_to_recordset(v_assignments) AS a("reservationId" uuid, "roomId" uuid, "adultCount" integer, "childCount" integer, "numberOfGuests" integer)
    WHERE r."id" = ANY(v_created_ids) AND a."reservationId" IS NULL AND r."room_id" = a."roomId";
  END IF;
  SELECT coalesce((value->>'reservationId')::uuid, (SELECT r."id" FROM "public"."reservations" r WHERE r."id" = ANY(v_created_ids) AND r."room_id" = (value->>'roomId')::uuid))
  INTO v_survivor FROM jsonb_array_elements(v_assignments) WITH ORDINALITY ORDER BY ordinality LIMIT 1;
  UPDATE "public"."folio_items" SET "reservation_id" = v_survivor WHERE "reservation_id" = ANY(v_cancel_ids) AND "amount" < 0;
  IF coalesce(("p_plan"->>'confirmNewRooms')::boolean, false) THEN
    UPDATE "public"."reservations" SET "status" = 'Confirmed', "hold_expires_at" = NULL WHERE "id" = ANY(v_created_ids);
  END IF;
  FOR v_row IN SELECT r.* FROM "public"."reservations" r WHERE r."id" = ANY(v_changed_ids || v_created_ids) ORDER BY r."id" LOOP
    PERFORM "public"."log_admin_activity_rpc"(
      "p_actor_user_id" => "p_actor_user_id", "p_section" => 'reservations',
      "p_action" => CASE WHEN v_row."id" = ANY(v_created_ids) THEN 'reservation_created' ELSE 'reservation_updated' END,
      "p_entity_type" => 'reservation', "p_entity_id" => v_row."id", "p_entity_label" => v_booking_id,
      "p_details" => CASE WHEN v_row."id" = ANY(v_created_ids) THEN 'Added room to booking ' ELSE 'Updated reservation ' END || v_booking_id,
      "p_metadata" => jsonb_build_object('operation', 'booking_edit', 'before', (SELECT value FROM jsonb_array_elements(v_before) WHERE value->>'id' = v_row."id"::text), 'after', to_jsonb(v_row))
    );
  END LOOP;
  SELECT jsonb_build_object('bookingId', v_booking_id, 'reservations', jsonb_agg(
    to_jsonb(r) || jsonb_build_object(
      'folio', coalesce((SELECT jsonb_agg(to_jsonb(f) ORDER BY f."timestamp", f."id") FROM "public"."folio_items" f WHERE f."reservation_id" = r."id"), '[]'::jsonb),
      'guest', (SELECT jsonb_build_object('first_name', g."first_name", 'last_name', g."last_name", 'email', g."email", 'phone', g."phone") FROM "public"."guests" g WHERE g."id" = r."guest_id")
    ) ORDER BY r."check_in_date", r."id"
  )) INTO v_result FROM "public"."reservations" r WHERE r."booking_id" = v_booking_id;
  RETURN v_result;
END;
$$;

COMMIT;

-- ROLLBACK: In a new migration restore only save_booking_edit from the pre-deployment schema backup.

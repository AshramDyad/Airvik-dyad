-- Local pgTAP integration tests. Fixtures and writes are rolled back at the end.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions, pg_temp;
SELECT no_plan();

CREATE FUNCTION pg_temp.edit_snapshot(p_booking text) RETURNS jsonb LANGUAGE sql AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', id, 'roomId', room_id, 'ratePlanId', rate_plan_id,
    'checkInDate', check_in_date, 'checkOutDate', check_out_date,
    'adultCount', adult_count, 'childCount', child_count, 'numberOfGuests', number_of_guests,
    'notes', notes, 'totalAmount', total_amount, 'taxEnabledSnapshot', tax_enabled_snapshot,
    'taxRateSnapshot', tax_rate_snapshot, 'status', status, 'paymentMethod', payment_method
  ) ORDER BY id), '[]'::jsonb)
  FROM public.reservations WHERE booking_id = p_booking AND status NOT IN ('Cancelled', 'No-show');
$$;

CREATE FUNCTION pg_temp.edit_plan(
  p_booking text, p_rooms uuid[] DEFAULT NULL, p_adults integer DEFAULT NULL,
  p_children integer DEFAULT 0, p_in date DEFAULT '2050-01-01',
  p_out date DEFAULT '2050-01-03', p_notes text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE
  v_primary public.reservations%ROWTYPE;
  v_rooms uuid[];
  v_adults integer;
  v_used uuid[] := ARRAY[]::uuid[];
  v_cancel uuid[];
  v_id uuid;
  v_assignments jsonb := '[]'::jsonb;
  v_room uuid;
  v_index integer := 0;
  v_count integer;
  v_adult integer;
  v_child integer;
BEGIN
  SELECT * INTO STRICT v_primary FROM public.reservations
    WHERE booking_id = p_booking AND status NOT IN ('Cancelled', 'No-show') ORDER BY id LIMIT 1;
  SELECT coalesce(p_rooms, array_agg(room_id ORDER BY id)), coalesce(p_adults, sum(adult_count)::integer)
    INTO v_rooms, v_adults FROM public.reservations
    WHERE booking_id = p_booking AND status NOT IN ('Cancelled', 'No-show');
  v_count := cardinality(v_rooms);
  FOREACH v_room IN ARRAY v_rooms LOOP
    SELECT id INTO v_id FROM public.reservations
      WHERE booking_id = p_booking AND status NOT IN ('Cancelled', 'No-show') AND room_id = v_room ORDER BY id LIMIT 1;
    IF v_id IS NULL THEN
      SELECT id INTO v_id FROM public.reservations
        WHERE booking_id = p_booking AND status NOT IN ('Cancelled', 'No-show')
          AND NOT (id = ANY(v_used)) AND NOT (room_id = ANY(v_rooms)) ORDER BY id LIMIT 1;
    END IF;
    IF v_id IS NOT NULL THEN v_used := array_append(v_used, v_id); END IF;
    v_adult := v_adults / v_count + CASE WHEN v_index < v_adults % v_count THEN 1 ELSE 0 END;
    v_child := p_children / v_count + CASE WHEN v_index < p_children % v_count THEN 1 ELSE 0 END;
    v_assignments := v_assignments || jsonb_build_array(jsonb_build_object(
      'reservationId', v_id, 'roomId', v_room, 'adultCount', v_adult, 'childCount', v_child,
      'numberOfGuests', v_adult + v_child, 'totalAmount', (p_out - p_in) * 100
    ));
    v_index := v_index + 1;
  END LOOP;
  SELECT coalesce(array_agg(id ORDER BY id), ARRAY[]::uuid[]) INTO v_cancel
    FROM public.reservations WHERE booking_id = p_booking AND status NOT IN ('Cancelled', 'No-show') AND NOT (id = ANY(v_used));
  RETURN jsonb_build_object(
    'bookingId', p_booking, 'primaryReservationId', v_primary.id,
    'checkInDate', p_in, 'checkOutDate', p_out, 'notes', p_notes,
    'ratePlanId', coalesce(v_primary.rate_plan_id, '94690000-0000-4000-8000-000000000006'::uuid),
    'taxEnabledSnapshot', v_primary.tax_enabled_snapshot, 'taxRateSnapshot', v_primary.tax_rate_snapshot,
    'adultCount', v_adults, 'childCount', p_children,
    'newRoomStatus', CASE WHEN v_primary.payment_method = 'UPI Gateway' THEN 'Room Hold' ELSE v_primary.status END,
    'confirmNewRooms', v_primary.payment_method = 'UPI Gateway' AND v_primary.status = 'Confirmed',
    'assignments', v_assignments, 'cancelIds', to_jsonb(v_cancel)
  );
END;
$$;

CREATE FUNCTION pg_temp.edit_save(p_booking text, p_plan jsonb DEFAULT NULL) RETURNS jsonb LANGUAGE sql AS $$
  SELECT public.save_booking_edit(
    (SELECT id FROM public.reservations WHERE booking_id = p_booking ORDER BY id LIMIT 1),
    '94690000-0000-4000-8000-000000000001', pg_temp.edit_snapshot(p_booking),
    coalesce(p_plan, pg_temp.edit_plan(p_booking))
  );
$$;

INSERT INTO public.roles(id, name, permissions) VALUES
  ('94690000-0000-4000-8000-000000000002', 'Atomic edit test', ARRAY['update:reservation','create:reservation']),
  ('94690000-0000-4000-8000-000000000003', 'Atomic update-only test', ARRAY['update:reservation']),
  ('94690000-0000-4000-8000-000000000004', 'Atomic no-permission test', ARRAY[]::text[]);
INSERT INTO auth.users(id, email, raw_user_meta_data, raw_app_meta_data)
  VALUES ('94690000-0000-4000-8000-000000000001', 'atomic-edit-test@example.invalid', '{}'::jsonb, '{}'::jsonb);
INSERT INTO public.profiles(id, name, role_id)
  VALUES ('94690000-0000-4000-8000-000000000001', 'Atomic edit tester', '94690000-0000-4000-8000-000000000002')
  ON CONFLICT (id) DO UPDATE SET role_id = EXCLUDED.role_id;
INSERT INTO public.guests(id, first_name, last_name)
  VALUES ('94690000-0000-4000-8000-000000000005', 'Local', 'Fixture');
INSERT INTO public.rate_plans(id, name, price)
  VALUES ('94690000-0000-4000-8000-000000000006', 'Atomic fixture rate', 100);
INSERT INTO public.room_types(id, name, max_occupancy, price)
  VALUES ('94690000-0000-4000-8000-000000000007', 'Atomic fixture room type', 4, 100);
INSERT INTO public.rooms(id, room_number, room_type_id, status)
  SELECT ('94690001-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
    CASE n WHEN 1 THEN 'test-206' WHEN 38 THEN 'test-210' ELSE 'test-atomic-' || n END,
    '94690000-0000-4000-8000-000000000007', 'Clean' FROM generate_series(1, 44) AS n;
INSERT INTO public.reservations(id, booking_id, guest_id, room_id, rate_plan_id, check_in_date, check_out_date,
  number_of_guests, adult_count, child_count, total_amount, status, source, tax_enabled_snapshot, tax_rate_snapshot)
  SELECT ('94690002-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid, 'A946900001',
    '94690000-0000-4000-8000-000000000005', ('94690001-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
    '94690000-0000-4000-8000-000000000006', '2050-01-01', '2050-01-03',
    CASE WHEN n <= 16 THEN 3 ELSE 2 END, CASE WHEN n <= 16 THEN 3 ELSE 2 END, 0, 200, 'Confirmed', 'reception', true, 0.12
  FROM generate_series(1, 37) AS n;
INSERT INTO public.folio_items(id, reservation_id, description, amount, payment_method, transaction_id, external_reference, external_metadata)
  VALUES ('94690003-0000-4000-8000-000000000001', '94690002-0000-4000-8000-000000000001',
    'Attached statement payment', -6800, 'UPI', 'S58965663', '627292156097', '{"statement":true}'),
  ('94690003-0000-4000-8000-000000000002', '94690002-0000-4000-8000-000000000037',
    'Existing charge', 300, NULL, NULL, NULL, '{}');
CREATE TEMP TABLE edit_results(label text PRIMARY KEY, result jsonb);

SELECT ok(NOT has_function_privilege('anon', 'public.save_booking_edit(uuid,uuid,jsonb,jsonb)', 'EXECUTE'), 'anonymous callers cannot save');
SELECT ok(NOT has_function_privilege('authenticated', 'public.save_booking_edit(uuid,uuid,jsonb,jsonb)', 'EXECUTE'), 'browser authenticated callers cannot save directly');
SELECT ok(has_function_privilege('service_role', 'public.save_booking_edit(uuid,uuid,jsonb,jsonb)', 'EXECUTE'), 'the server service role can save');

-- Existing bookings may store no notes as NULL, an empty string, or whitespace.
UPDATE public.reservations SET notes = CASE
  WHEN id = '94690002-0000-4000-8000-000000000001' THEN ''
  WHEN id = '94690002-0000-4000-8000-000000000002' THEN E' \t\n'
  ELSE NULL END WHERE booking_id = 'A946900001';
INSERT INTO edit_results VALUES ('no-change', pg_temp.edit_save('A946900001'));
SELECT is((SELECT count(*) FROM public.admin_activity_logs WHERE entity_label = 'A946900001'), 0::bigint, 'no-change save performs no reservation activity writes');
SELECT is((SELECT count(*) FROM public.reservations WHERE booking_id = 'A946900001' AND status = 'Confirmed'), 37::bigint, 'no-change keeps all 37 rooms');
SELECT is((SELECT notes FROM public.reservations WHERE id = '94690002-0000-4000-8000-000000000001'), '', 'empty notes are preserved on a no-change save');
SELECT is((SELECT notes FROM public.reservations WHERE id = '94690002-0000-4000-8000-000000000002'), E' \t\n', 'whitespace-only notes are preserved on a no-change save');

INSERT INTO edit_results VALUES ('swap', pg_temp.edit_save('A946900001', pg_temp.edit_plan('A946900001',
  ARRAY['94690001-0000-4000-8000-000000000038'::uuid] ||
  ARRAY(SELECT ('94690001-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid FROM generate_series(2, 37) AS n))));
SELECT is((SELECT room_id::text FROM public.reservations WHERE id = '94690002-0000-4000-8000-000000000001'),
  '94690001-0000-4000-8000-000000000038', 'room 206 was replaced with 210 on the original reservation ID');
SELECT is((SELECT sum(number_of_guests) FROM public.reservations WHERE booking_id = 'A946900001' AND status = 'Confirmed'), 90::bigint, '37-room swap preserves 90 guests after a fresh read');
SELECT is((SELECT sum(total_amount) FROM public.reservations WHERE booking_id = 'A946900001'), 7400::numeric, '37-room totals remain consistent');
SELECT is((SELECT reservation_id::text FROM public.folio_items WHERE id = '94690003-0000-4000-8000-000000000001'),
  '94690002-0000-4000-8000-000000000001', 'room replacement does not detach its payment');
SELECT is((SELECT count(*) FROM public.admin_activity_logs WHERE entity_label = 'A946900001'), 1::bigint, 'only the replaced room is updated when notes are blank');
SELECT is((SELECT notes FROM public.reservations WHERE id = '94690002-0000-4000-8000-000000000001'), '', 'a changed room preserves its existing blank notes');
SELECT is((SELECT notes FROM public.reservations WHERE id = '94690002-0000-4000-8000-000000000002'), E' \t\n', 'an unchanged room preserves its whitespace-only notes');
SELECT is(jsonb_array_length((SELECT result->'reservations' FROM edit_results WHERE label = 'swap')), 37, 'save returns all canonical booking rows');
SELECT ok(EXISTS (SELECT 1 FROM edit_results, jsonb_array_elements(result->'reservations') r,
  jsonb_array_elements(r->'folio') f WHERE label = 'swap' AND f->>'transaction_id' = 'S58965663'), 'save result includes payment references');

INSERT INTO edit_results VALUES ('notes-added', pg_temp.edit_save('A946900001', pg_temp.edit_plan('A946900001', p_notes => 'Actual note')));
SELECT is((SELECT count(*) FROM public.reservations WHERE booking_id = 'A946900001' AND notes = 'Actual note'), 37::bigint, 'adding a real note updates all rooms');
INSERT INTO edit_results VALUES ('notes-cleared', pg_temp.edit_save('A946900001', pg_temp.edit_plan('A946900001')));
SELECT is((SELECT count(*) FROM public.reservations WHERE booking_id = 'A946900001' AND notes IS NULL), 37::bigint, 'clearing a real note saves the removal');

-- Permissions, stale edits, invalid plans and room conflicts are checked by the database too.
UPDATE public.profiles SET role_id = '94690000-0000-4000-8000-000000000004' WHERE id = '94690000-0000-4000-8000-000000000001';
SELECT throws_ok($$SELECT pg_temp.edit_save('A946900001')$$, '42501', 'Insufficient permissions', 'missing update permission is rejected');
UPDATE public.profiles SET role_id = '94690000-0000-4000-8000-000000000003' WHERE id = '94690000-0000-4000-8000-000000000001';
SELECT throws_ok($$SELECT pg_temp.edit_save('A946900001', pg_temp.edit_plan('A946900001',
  ARRAY(SELECT ('94690001-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid FROM generate_series(2,39) n)))$$,
  '42501', 'Creating additional rooms requires reservation create permission.', 'adding a row needs create AND update permission');
UPDATE public.profiles SET role_id = '94690000-0000-4000-8000-000000000002' WHERE id = '94690000-0000-4000-8000-000000000001';
CREATE TEMP TABLE stale_edit AS SELECT pg_temp.edit_snapshot('A946900001') AS snapshot, pg_temp.edit_plan('A946900001') AS plan;
UPDATE public.reservations SET notes = 'Changed by another staff member' WHERE id = '94690002-0000-4000-8000-000000000001';
SELECT throws_ok($$SELECT public.save_booking_edit('94690002-0000-4000-8000-000000000001', '94690000-0000-4000-8000-000000000001', snapshot, plan) FROM stale_edit$$,
  'PT409', 'This booking changed. Reload it before saving.', 'an original stale snapshot returns a non-retryable conflict');
SELECT is((SELECT notes FROM public.reservations WHERE id = '94690002-0000-4000-8000-000000000001'), 'Changed by another staff member', 'rejected stale save preserves the newer notes');
SELECT throws_ok($$SELECT pg_temp.edit_save('A946900001', jsonb_set(pg_temp.edit_plan('A946900001'), '{adultCount}', '-1'))$$,
  '22023', 'Invalid booking values.', 'negative guest count is rejected');
SELECT throws_ok($$SELECT pg_temp.edit_save('A946900001', jsonb_set(pg_temp.edit_plan('A946900001'), '{assignments,0,reservationId}', '"94690002-0000-4000-8000-000000999999"'))$$,
  '22023', 'Reservation assignments do not match this booking.', 'an unrelated reservation ID cannot be supplied');
INSERT INTO public.reservations(booking_id, guest_id, room_id, rate_plan_id, check_in_date, check_out_date, number_of_guests, status, total_amount, source)
  VALUES ('A946900002', '94690000-0000-4000-8000-000000000005', '94690001-0000-4000-8000-000000000044',
    '94690000-0000-4000-8000-000000000006', '2050-01-01', '2050-01-03', 1, 'Room Hold', 200, 'reception');
SELECT throws_ok($$SELECT pg_temp.edit_save('A946900001', pg_temp.edit_plan('A946900001',
  ARRAY(SELECT ('94690001-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid FROM generate_series(2,37) n) || ARRAY['94690001-0000-4000-8000-000000000044'::uuid]))$$,
  '23P01', 'One or more rooms are already booked for the selected dates.', 'manual room holds still block competing edits');
INSERT INTO public.booking_restrictions(restriction_type, room_type_id, start_date, end_date, value)
  VALUES ('min_stay', '94690000-0000-4000-8000-000000000007', '2050-01-01', '2050-01-31', '{"minNights":3}');
SELECT throws_ok($$SELECT pg_temp.edit_save('A946900001')$$, '22023', 'Minimum stay not met', 'existing minimum-stay rules are enforced inside the transaction');
DELETE FROM public.booking_restrictions WHERE room_type_id = '94690000-0000-4000-8000-000000000007';

-- Adding rooms uses the existing creation function, with exact allocation/tax applied atomically.
INSERT INTO edit_results VALUES ('grow', pg_temp.edit_save('A946900001', pg_temp.edit_plan('A946900001',
  ARRAY(SELECT ('94690001-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid FROM generate_series(2,39) n), 91, 1,
  '2050-01-01', '2050-01-04', 'New notes')));
SELECT is((SELECT count(*) FROM public.reservations WHERE booking_id = 'A946900001' AND status = 'Confirmed'), 38::bigint, 'one extra row is created');
SELECT is((SELECT sum(adult_count) FROM public.reservations WHERE booking_id = 'A946900001' AND status = 'Confirmed'), 91::bigint, 'new adult allocation persists');
SELECT is((SELECT sum(child_count) FROM public.reservations WHERE booking_id = 'A946900001' AND status = 'Confirmed'), 1::bigint, 'new child allocation persists');
SELECT ok(NOT EXISTS (SELECT 1 FROM public.reservations WHERE booking_id = 'A946900001' AND (notes <> 'New notes' OR check_out_date <> '2050-01-04' OR NOT tax_enabled_snapshot OR tax_rate_snapshot <> 0.12)), 'dates, notes and saved tax apply to existing and new rows');

-- Removing the row carrying a payment moves payments only; charges and removed metadata stay.
INSERT INTO public.folio_items(reservation_id, description, amount, payment_method)
  VALUES ('94690002-0000-4000-8000-000000000001', 'Charge stays on removed row', 50, NULL);
INSERT INTO edit_results VALUES ('shrink', pg_temp.edit_save('A946900001', pg_temp.edit_plan('A946900001',
  ARRAY(SELECT ('94690001-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid FROM generate_series(2,37) n), 90)));
SELECT is((SELECT status FROM public.reservations WHERE id = '94690002-0000-4000-8000-000000000001'), 'Cancelled', 'removed row is cancelled, never deleted');
SELECT ok((SELECT (external_metadata->>'removedDuringEdit')::boolean AND external_metadata ? 'removedAt' FROM public.reservations WHERE id = '94690002-0000-4000-8000-000000000001'), 'removal metadata is preserved');
SELECT ok((SELECT reservation_id <> '94690002-0000-4000-8000-000000000001' AND transaction_id = 'S58965663' AND external_reference = '627292156097' AND external_metadata = '{"statement":true}'::jsonb FROM public.folio_items WHERE id = '94690003-0000-4000-8000-000000000001'), 'payment is rehomed with its references and metadata unchanged');
SELECT is((SELECT count(*) FROM public.folio_items WHERE reservation_id = '94690002-0000-4000-8000-000000000001' AND amount > 0), 1::bigint, 'positive charges are not moved');

-- Force failure at the last stage, after updates/cancellations/creation/payment movement.
CREATE TEMP TABLE before_failure AS SELECT
  (SELECT jsonb_agg(to_jsonb(r) ORDER BY id) FROM public.reservations r WHERE booking_id = 'A946900001') AS reservations,
  (SELECT jsonb_agg(to_jsonb(f) ORDER BY f.id) FROM public.folio_items f JOIN public.reservations r ON r.id = f.reservation_id WHERE r.booking_id = 'A946900001') AS folios,
  (SELECT count(*) FROM public.admin_activity_logs WHERE entity_label = 'A946900001') AS activities;
CREATE FUNCTION pg_temp.fail_edit_activity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.entity_label = 'A946900001' THEN RAISE EXCEPTION 'Forced audit failure' USING ERRCODE = 'P0001'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER test_fail_edit_activity BEFORE INSERT ON public.admin_activity_logs FOR EACH ROW EXECUTE FUNCTION pg_temp.fail_edit_activity();
SELECT throws_ok($$SELECT pg_temp.edit_save('A946900001', pg_temp.edit_plan('A946900001',
  ARRAY(SELECT ('94690001-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid FROM generate_series(4,40) n), 90, 0,
  '2050-01-01', '2050-01-05', 'Must roll back'))$$, 'P0001', 'Forced audit failure', 'a failure after earlier writes rejects the whole save');
DROP TRIGGER test_fail_edit_activity ON public.admin_activity_logs;
SELECT is((SELECT jsonb_agg(to_jsonb(r) ORDER BY id) FROM public.reservations r WHERE booking_id = 'A946900001'), (SELECT reservations FROM before_failure), 'all reservation updates, cancellations and inserts roll back');
SELECT is((SELECT jsonb_agg(to_jsonb(f) ORDER BY f.id) FROM public.folio_items f JOIN public.reservations r ON r.id = f.reservation_id WHERE r.booking_id = 'A946900001'), (SELECT folios FROM before_failure), 'payment movement rolls back');
SELECT is((SELECT count(*) FROM public.admin_activity_logs WHERE entity_label = 'A946900001'), (SELECT activities FROM before_failure), 'activity records roll back');

-- Imported bookings retain the existing rate fallback, and custom totals are kept.
UPDATE public.reservations SET rate_plan_id = NULL, source = 'vikbooking' WHERE booking_id = 'A946900001' AND status = 'Confirmed';
INSERT INTO edit_results VALUES ('imported', pg_temp.edit_save('A946900001', jsonb_set(pg_temp.edit_plan('A946900001'), '{assignments,0,totalAmount}', '123')));
SELECT is((SELECT total_amount FROM public.reservations WHERE id = '94690002-0000-4000-8000-000000000002'), 123::numeric, 'calculated custom total is saved');
SELECT ok(NOT EXISTS (SELECT 1 FROM public.reservations WHERE booking_id = 'A946900001' AND status = 'Confirmed' AND rate_plan_id IS NULL), 'imported rows receive the chosen fallback rate plan');

-- Gateway new rooms must start on hold; confirmation still requires a real matched/override payment.
INSERT INTO public.reservations(id, booking_id, guest_id, room_id, rate_plan_id, check_in_date, check_out_date,
  number_of_guests, adult_count, status, total_amount, payment_method, source)
  VALUES ('94690002-0000-4000-8000-000000000041', 'A946900003', '94690000-0000-4000-8000-000000000005',
    '94690001-0000-4000-8000-000000000041', '94690000-0000-4000-8000-000000000006', '2050-01-01', '2050-01-03', 2, 2, 'Room Hold', 200, 'UPI Gateway', 'website');
SELECT throws_ok($$UPDATE public.reservations SET status = 'Confirmed' WHERE id = '94690002-0000-4000-8000-000000000041'$$,
  '23514', 'UPI Gateway reservations can be confirmed only after matched payment or admin override.', 'gateway confirmation guard remains enforced');
INSERT INTO edit_results VALUES ('gateway-hold', pg_temp.edit_save('A946900003', pg_temp.edit_plan('A946900003', ARRAY['94690001-0000-4000-8000-000000000041'::uuid, '94690001-0000-4000-8000-000000000042'::uuid])));
SELECT is((SELECT count(*) FROM public.reservations WHERE booking_id = 'A946900003' AND status = 'Room Hold'), 2::bigint, 'unpaid gateway extras remain on hold');
INSERT INTO public.folio_items(reservation_id, description, amount, payment_method, external_source)
  VALUES ('94690002-0000-4000-8000-000000000041', 'Matched gateway payment', -400, 'UPI Gateway', 'payment_request');
UPDATE public.reservations SET status = 'Confirmed' WHERE booking_id = 'A946900003';
INSERT INTO edit_results VALUES ('gateway-confirmed', pg_temp.edit_save('A946900003', pg_temp.edit_plan('A946900003', ARRAY['94690001-0000-4000-8000-000000000041'::uuid, '94690001-0000-4000-8000-000000000042'::uuid, '94690001-0000-4000-8000-000000000043'::uuid])));
SELECT is((SELECT count(*) FROM public.reservations WHERE booking_id = 'A946900003' AND status = 'Confirmed'), 3::bigint, 'matched gateway bookings confirm extras using the existing guard');
SELECT lives_ok($$UPDATE public.reservations SET status = 'Checked-in' WHERE booking_id = 'A946900003'; UPDATE public.reservations SET status = 'Checked-out' WHERE booking_id = 'A946900003'$$, 'existing check-in and check-out paths remain compatible');

SELECT * FROM finish();
ROLLBACK;

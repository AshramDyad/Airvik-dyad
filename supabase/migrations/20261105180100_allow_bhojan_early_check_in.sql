BEGIN;
SET search_path TO public;

CREATE OR REPLACE FUNCTION "public"."validate_bhojan_pass"("p_token" uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p public.bhojan_passes; r public.reservations; reason text; room text; local_now timestamp;
BEGIN
 SELECT * INTO p FROM public.bhojan_passes WHERE token=p_token;
 IF NOT FOUND THEN RETURN jsonb_build_object('valid',false,'reason','Invalid pass'); END IF;
 PERFORM public.reconcile_bhojan_passes(p.reservation_id);
 SELECT * INTO p FROM public.bhojan_passes WHERE token=p_token;
 SELECT * INTO r FROM public.reservations WHERE id=p.reservation_id;
 local_now := clock_timestamp() AT TIME ZONE 'Asia/Kolkata';
 reason := CASE
  WHEN p.revoked THEN 'Pass no longer active'
  WHEN local_now >= r.check_out_date + time '11:59' THEN 'Pass expired'
  WHEN r.status <> 'Checked-in' THEN 'Not checked in'
  ELSE 'Valid pass' END;
 SELECT room_number INTO room FROM public.rooms WHERE id=r.room_id;
 RETURN jsonb_build_object('valid',reason='Valid pass','reason',reason,'passNumber',p.pass_number,'room',room);
END; $$;

REVOKE ALL ON FUNCTION "public"."validate_bhojan_pass"(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION "public"."validate_bhojan_pass"(uuid) TO service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;

-- ROLLBACK: restore the previous function from 20261105180000_add_bhojan_passes.sql in a new migration.

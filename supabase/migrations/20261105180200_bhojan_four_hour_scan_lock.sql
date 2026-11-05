BEGIN;
SET search_path TO public;

ALTER TABLE "public"."bhojan_passes"
  ADD COLUMN IF NOT EXISTS "last_scanned_at" timestamptz;

CREATE OR REPLACE FUNCTION "public"."validate_bhojan_pass"("p_token" uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
 p public.bhojan_passes; r public.reservations; reason text; room text;
 scan_time timestamptz; local_now timestamp;
BEGIN
 SELECT * INTO p FROM public.bhojan_passes WHERE token=p_token;
 IF NOT FOUND THEN RETURN jsonb_build_object('valid',false,'reason','Invalid pass'); END IF;
 -- Keep the existing reservation-first lock order used by booking edits.
 PERFORM public.reconcile_bhojan_passes(p.reservation_id);
 SELECT * INTO p FROM public.bhojan_passes WHERE token=p_token FOR UPDATE;
 SELECT * INTO r FROM public.reservations WHERE id=p.reservation_id;
 scan_time := clock_timestamp();
 local_now := scan_time AT TIME ZONE 'Asia/Kolkata';
 reason := CASE
  WHEN p.revoked THEN 'Pass no longer active'
  WHEN local_now >= r.check_out_date + time '11:59' THEN 'Pass expired'
  WHEN r.status <> 'Checked-in' THEN 'Not checked in'
  WHEN p.last_scanned_at > scan_time - interval '4 hours'
   THEN 'Already scanned at ' || to_char(p.last_scanned_at AT TIME ZONE 'Asia/Kolkata', 'FMHH12:MI AM')
  ELSE 'Valid pass' END;
 IF reason = 'Valid pass' THEN
  UPDATE public.bhojan_passes SET last_scanned_at=scan_time WHERE id=p.id;
 END IF;
 SELECT room_number INTO room FROM public.rooms WHERE id=r.room_id;
 RETURN jsonb_build_object('valid',reason='Valid pass','reason',reason,'passNumber',p.pass_number,'room',room);
END; $$;

REVOKE ALL ON FUNCTION "public"."validate_bhojan_pass"(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION "public"."validate_bhojan_pass"(uuid) TO service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;

-- ROLLBACK: restore the function from 20261105180100_allow_bhojan_early_check_in.sql in a new migration, then drop last_scanned_at if no longer needed.

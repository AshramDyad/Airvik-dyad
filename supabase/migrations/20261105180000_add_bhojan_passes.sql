BEGIN;
SET search_path TO public;
CREATE TABLE public.bhojan_passes (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
 booking_id text NOT NULL,
 reservation_id uuid NOT NULL REFERENCES public.reservations(id),
 pass_number integer NOT NULL CHECK (pass_number > 0),
 revoked boolean NOT NULL DEFAULT false,
 issued_at timestamptz NOT NULL DEFAULT now(),
 issued_by uuid NOT NULL REFERENCES auth.users(id),
 send_state text NOT NULL DEFAULT 'new' CHECK (send_state IN ('new','sending','accepted','uncertain','failed')),
 message_id text,
 sent_at timestamptz,
 UNIQUE (booking_id, pass_number)
);
CREATE INDEX bhojan_passes_reservation_idx ON public.bhojan_passes(reservation_id);
ALTER TABLE public.bhojan_passes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bhojan_passes FROM anon, authenticated;
GRANT ALL ON public.bhojan_passes TO service_role;

CREATE TABLE public.whatsapp_inbound_windows (
 phone_number_id text NOT NULL,
 sender text NOT NULL,
 last_message_at timestamptz NOT NULL,
 PRIMARY KEY (phone_number_id, sender)
);
ALTER TABLE public.whatsapp_inbound_windows ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.whatsapp_inbound_windows FROM anon, authenticated;
GRANT ALL ON public.whatsapp_inbound_windows TO service_role;

CREATE FUNCTION public.record_whatsapp_inbound(p_phone text, p_sender text, p_at timestamptz)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
 INSERT INTO public.whatsapp_inbound_windows VALUES (p_phone,p_sender,p_at)
 ON CONFLICT (phone_number_id,sender) DO UPDATE
 SET last_message_at = greatest(whatsapp_inbound_windows.last_message_at, excluded.last_message_at);
$$;

-- Called with the reservation locked. A decrease permanently revokes excess tokens.
CREATE FUNCTION public.reconcile_bhojan_passes(p_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.reservations;
BEGIN
 SELECT * INTO r FROM public.reservations WHERE id=p_id FOR UPDATE;
 UPDATE public.bhojan_passes SET revoked=true WHERE id IN (
  SELECT id FROM (
   SELECT id, row_number() OVER (ORDER BY pass_number) AS position
   FROM public.bhojan_passes WHERE reservation_id=p_id AND NOT revoked
  ) ranked WHERE position > CASE WHEN r.status IN ('Confirmed','Checked-in')
    THEN greatest(0,r.number_of_guests) ELSE 0 END
 );
END; $$;
CREATE FUNCTION public.bhojan_reservation_changed() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF NEW.number_of_guests IS DISTINCT FROM OLD.number_of_guests OR NEW.status IS DISTINCT FROM OLD.status THEN
  PERFORM public.reconcile_bhojan_passes(NEW.id);
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER bhojan_reservation_changed AFTER UPDATE OF number_of_guests,status ON public.reservations
FOR EACH ROW EXECUTE FUNCTION public.bhojan_reservation_changed();

CREATE FUNCTION public.issue_bhojan_passes(p_id uuid,p_actor uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE b text; r public.reservations; n integer; next_number integer;
BEGIN
 IF NOT public.user_has_permission(p_actor,'update:reservation') THEN RAISE EXCEPTION 'Permission denied'; END IF;
 SELECT booking_id INTO STRICT b FROM public.reservations WHERE id=p_id;
 PERFORM pg_advisory_xact_lock(hashtextextended('bhojan:'||b,0));
 SELECT coalesce(max(pass_number),0) INTO next_number FROM public.bhojan_passes WHERE booking_id=b;
 FOR r IN SELECT * FROM public.reservations WHERE booking_id=b ORDER BY id FOR UPDATE LOOP
  PERFORM public.reconcile_bhojan_passes(r.id);
  IF r.status NOT IN ('Confirmed','Checked-in') THEN CONTINUE; END IF;
  SELECT count(*) INTO n FROM public.bhojan_passes WHERE reservation_id=r.id AND NOT revoked;
  WHILE n < r.number_of_guests LOOP
   next_number := next_number+1;
   INSERT INTO public.bhojan_passes(booking_id,reservation_id,pass_number,issued_by)
   VALUES(b,r.id,next_number,p_actor);
   n := n+1;
  END LOOP;
 END LOOP;
END; $$;

CREATE FUNCTION public.validate_bhojan_pass(p_token uuid) RETURNS jsonb
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
  WHEN local_now::date < r.check_in_date THEN 'Stay has not started'
  WHEN r.status <> 'Checked-in' THEN 'Not checked in'
  ELSE 'Valid pass' END;
 SELECT room_number INTO room FROM public.rooms WHERE id=r.room_id;
 RETURN jsonb_build_object('valid',reason='Valid pass','reason',reason,'passNumber',p.pass_number,'room',room);
END; $$;

REVOKE ALL ON FUNCTION public.record_whatsapp_inbound(text,text,timestamptz),public.reconcile_bhojan_passes(uuid),public.bhojan_reservation_changed(),public.issue_bhojan_passes(uuid,uuid),public.validate_bhojan_pass(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.record_whatsapp_inbound(text,text,timestamptz),public.reconcile_bhojan_passes(uuid),public.issue_bhojan_passes(uuid,uuid),public.validate_bhojan_pass(uuid) TO service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;
-- ROLLBACK: DROP TRIGGER bhojan_reservation_changed ON public.reservations;
-- DROP FUNCTION public.bhojan_reservation_changed(),public.issue_bhojan_passes(uuid,uuid),public.validate_bhojan_pass(uuid),public.reconcile_bhojan_passes(uuid),public.record_whatsapp_inbound(text,text,timestamptz);
-- DROP TABLE public.bhojan_passes,public.whatsapp_inbound_windows;

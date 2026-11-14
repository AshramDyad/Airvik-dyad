BEGIN;
CREATE TABLE public.admin_browsing_intervals (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  session_id uuid NOT NULL,
  tab_id uuid NOT NULL,
  visit_id uuid NOT NULL,
  pathname text NOT NULL CHECK (length(pathname) <= 300 AND pathname ~ '^/admin(/[a-zA-Z0-9_-]+)*/?$'),
  page text NOT NULL CHECK (length(page) BETWEEN 1 AND 160),
  section text CHECK (length(section) <= 160),
  dialog text CHECK (length(dialog) <= 160),
  booking text CHECK (length(booking) <= 40 AND booking ~ '^[a-zA-Z0-9-]+$'),
  state text NOT NULL CHECK (state IN ('active','idle','background')),
  booking_seen boolean NOT NULL DEFAULT false,
  started_at timestamptz NOT NULL,
  ended_at timestamptz NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  sequence integer NOT NULL CHECK (sequence > 0),
  end_reason text NOT NULL CHECK (end_reason IN ('checkpoint','change','gap','closed')),
  CHECK (ended_at >= started_at AND ended_at <= started_at + interval '5 minutes')
);
CREATE INDEX admin_browsing_user_time ON public.admin_browsing_intervals(user_id, started_at DESC);
CREATE INDEX admin_browsing_time ON public.admin_browsing_intervals(started_at DESC);
CREATE INDEX admin_browsing_booking_time ON public.admin_browsing_intervals(booking, started_at DESC) WHERE booking IS NOT NULL;
ALTER TABLE public.admin_browsing_intervals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_browsing_intervals FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.record_admin_browsing(p_intervals jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE actor uuid := auth.uid(); sid uuid := (auth.jwt()->>'session_id')::uuid; item jsonb; r public.admin_browsing_intervals; n integer;
BEGIN
  IF actor IS NULL OR sid IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles p JOIN public.roles role ON role.id=p.role_id
    WHERE p.id=actor AND role.name IN ('Administration','Hotel Owner','Hotel Manager','Receptionist','Housekeeper','Rishiraj-ji','Accountant')
  ) THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
  IF jsonb_typeof(p_intervals) IS DISTINCT FROM 'array' OR jsonb_array_length(p_intervals) NOT BETWEEN 1 AND 50 OR octet_length(p_intervals::text)>48000 THEN
    RAISE EXCEPTION 'Invalid batch'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(actor::text, 971));
  SELECT count(*) INTO n FROM public.admin_browsing_intervals WHERE user_id=actor AND started_at>now()-interval '1 minute';
  IF n>500 THEN RAISE EXCEPTION 'History rate limit'; END IF;
  IF (SELECT count(*) FROM public.admin_browsing_intervals WHERE user_id=actor AND started_at>now()-interval '24 hours') > 6000 THEN
    RAISE EXCEPTION 'History daily limit'; END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(p_intervals) LOOP
    IF (item->>'session_id')::uuid IS DISTINCT FROM sid THEN RAISE EXCEPTION 'Session mismatch' USING ERRCODE='42501'; END IF;
    r := jsonb_populate_record(NULL::public.admin_browsing_intervals,item);
    IF r.started_at < now()-interval '24 hours' OR r.ended_at>now()+interval '1 minute' OR r.started_at IS NULL OR r.ended_at IS NULL THEN RAISE EXCEPTION 'Invalid observation time'; END IF;
    INSERT INTO public.admin_browsing_intervals AS old (id,user_id,session_id,tab_id,visit_id,pathname,page,section,dialog,booking,state,booking_seen,started_at,ended_at,sequence,end_reason)
    VALUES(r.id,actor,sid,r.tab_id,r.visit_id,r.pathname,r.page,r.section,r.dialog,r.booking,r.state,r.booking_seen,r.started_at,r.ended_at,r.sequence,r.end_reason)
    ON CONFLICT(id) DO UPDATE SET ended_at=excluded.ended_at, sequence=excluded.sequence,
      end_reason=excluded.end_reason, received_at=now(), booking_seen=old.booking_seen OR excluded.booking_seen
    WHERE old.user_id=actor AND old.session_id=sid AND old.tab_id=excluded.tab_id AND old.visit_id=excluded.visit_id
      AND old.started_at=excluded.started_at AND old.pathname=excluded.pathname AND old.state=excluded.state
      AND old.page=excluded.page AND old.section IS NOT DISTINCT FROM excluded.section
      AND old.dialog IS NOT DISTINCT FROM excluded.dialog AND old.booking IS NOT DISTINCT FROM excluded.booking
      AND excluded.sequence>old.sequence AND excluded.ended_at>=old.ended_at;
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.record_admin_browsing(jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.record_admin_browsing(jsonb) TO authenticated;

CREATE FUNCTION public.get_admin_browsing_history(p_from date, p_to date, p_user uuid DEFAULT NULL, p_page text DEFAULT NULL, p_booking text DEFAULT NULL, p_offset integer DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE result jsonb; start_time timestamptz; stop_time timestamptz;
BEGIN
  IF auth.uid() IS DISTINCT FROM '04ce4714-0567-4bc0-b2b7-2e940f87ff52'::uuid OR NOT EXISTS (
    SELECT 1 FROM public.profiles p JOIN public.roles r ON r.id=p.role_id WHERE p.id=auth.uid()
      AND r.name IN ('Administration','Hotel Owner','Hotel Manager','Receptionist','Housekeeper','Rishiraj-ji','Accountant')
  ) THEN RAISE EXCEPTION 'History access denied' USING ERRCODE='42501'; END IF;
  IF p_from IS NULL OR p_to IS NULL OR p_to<p_from OR p_to-p_from>90 OR p_offset<0 OR p_offset>100000 THEN RAISE EXCEPTION 'Invalid history range'; END IF;
  start_time := greatest(p_from::timestamp AT TIME ZONE 'Asia/Kolkata', now()-interval '90 days');
  stop_time := (p_to+1)::timestamp AT TIME ZONE 'Asia/Kolkata';
  WITH filtered AS MATERIALIZED (
    SELECT i.* FROM public.admin_browsing_intervals i
    WHERE i.started_at>=start_time-interval '5 minutes' AND i.started_at<stop_time AND i.ended_at>=start_time
      AND (p_user IS NULL OR i.user_id=p_user) AND (nullif(p_page,'') IS NULL OR i.page ILIKE '%'||p_page||'%')
      AND (nullif(p_booking,'') IS NULL OR i.booking=p_booking)
  ), daily AS (
    SELECT f.*, d.day::date AS day,
      greatest(f.started_at,start_time,d.day AT TIME ZONE 'Asia/Kolkata') AS a,
      least(f.ended_at,stop_time,(d.day+interval '1 day') AT TIME ZONE 'Asia/Kolkata') AS b
    FROM filtered f CROSS JOIN LATERAL generate_series(
      (f.started_at AT TIME ZONE 'Asia/Kolkata')::date::timestamp,
      (f.ended_at AT TIME ZONE 'Asia/Kolkata')::date::timestamp,interval '1 day') d(day)
  ), grouped AS (
    SELECT user_id,day,min(a) AS first_seen,max(b) AS last_seen,
      count(DISTINCT booking) FILTER(WHERE booking_seen) AS unique_bookings,
      count(DISTINCT visit_id) FILTER(WHERE booking_seen) AS booking_visits,
      count(DISTINCT pathname) AS pages,
      bool_or(end_reason='gap' OR (end_reason='checkpoint' AND received_at<now()-interval '90 seconds')) AS incomplete,
      range_agg(tstzrange(a,b,'[)')) FILTER(WHERE state='active' AND b>a) AS active_ranges
    FROM daily WHERE b>a OR (started_at=ended_at AND a=b AND day=(started_at AT TIME ZONE 'Asia/Kolkata')::date) GROUP BY user_id,day
  ), summaries AS (
    SELECT g.user_id,g.day,coalesce(nullif(btrim(p.name),''),u.email,'Former admin') AS name,g.first_seen,g.last_seen,g.unique_bookings,g.booking_visits,g.pages,g.incomplete,
      coalesce((SELECT sum(extract(epoch FROM upper(x)-lower(x))) FROM unnest(g.active_ranges) x),0) AS active_seconds
    FROM grouped g LEFT JOIN public.profiles p ON p.id=g.user_id LEFT JOIN auth.users u ON u.id=g.user_id
  ), events AS (
    SELECT i.id,i.user_id,i.started_at AS at,jsonb_build_object('id',i.id,'user_id',i.user_id,'kind','browsing','at',i.started_at,'until',i.ended_at,'page',i.page,'pathname',i.pathname,'booking',i.booking,'section',i.section,'dialog',i.dialog,'state',i.state,'tab',left(i.tab_id::text,6),'reason',i.end_reason,'incomplete',i.end_reason='gap' OR (i.end_reason='checkpoint' AND i.received_at<now()-interval '90 seconds')) AS data FROM filtered i
    UNION ALL
    SELECT l.id,l.actor_user_id,l.created_at,jsonb_build_object('id',l.id,'user_id',l.actor_user_id,'kind','action','at',l.created_at,'page',l.section,'action',l.action,'details',l.details,'booking',l.entity_label)
    FROM public.admin_activity_logs l WHERE l.created_at>=start_time AND l.created_at<stop_time
      AND (p_user IS NULL OR l.actor_user_id=p_user) AND (nullif(p_page,'') IS NULL OR l.section ILIKE '%'||p_page||'%')
      AND (nullif(p_booking,'') IS NULL OR l.entity_label=p_booking)
  ), paged AS (SELECT e.data || jsonb_build_object('name',coalesce(nullif(btrim(p.name),''),u.email,'Former admin')) AS data,e.at,e.id FROM events e LEFT JOIN public.profiles p ON p.id=e.user_id LEFT JOIN auth.users u ON u.id=e.user_id ORDER BY e.at DESC,e.id DESC LIMIT 51 OFFSET p_offset)
  SELECT jsonb_build_object('summary',coalesce((SELECT jsonb_agg(to_jsonb(s) ORDER BY day DESC,name) FROM summaries s),'[]'::jsonb),
    'events',coalesce((SELECT jsonb_agg(data ORDER BY at DESC,id DESC) FROM paged),'[]'::jsonb)) INTO result;
  RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.get_admin_browsing_history(date,date,uuid,text,text,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_admin_browsing_history(date,date,uuid,text,text,integer) TO authenticated;

CREATE EXTENSION IF NOT EXISTS pg_cron;
SELECT cron.schedule('admin-browsing-retention','15 3 * * *', $job$
  DELETE FROM public.admin_browsing_intervals WHERE id IN (
    SELECT id FROM public.admin_browsing_intervals WHERE started_at < now()-interval '90 days' ORDER BY started_at LIMIT 50000
  );
$job$);
COMMIT;

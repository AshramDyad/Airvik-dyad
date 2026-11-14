BEGIN;
SET search_path TO public;

-- Presence is ephemeral. Account identity comes from the authorized topic.
DROP POLICY IF EXISTS "admin_live_presence_read" ON "realtime"."messages";
CREATE POLICY "admin_live_presence_read"
ON "realtime"."messages" FOR SELECT TO authenticated
USING (
  -- Realtime 2.86 checks Broadcast read permission at private-channel join.
  -- No Broadcast writes are granted; both reads have identical account guards.
  "extension" IN ('presence', 'broadcast')
  AND (SELECT realtime.topic()) ~ '^admin-live:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND public.get_user_role((SELECT auth.uid())) IN (
    'Administration', 'Hotel Owner', 'Hotel Manager', 'Receptionist',
    'Housekeeper', 'Rishiraj-ji', 'Accountant'
  )
  AND (
    (SELECT realtime.topic()) = 'admin-live:' || (SELECT auth.uid())::text
    OR (SELECT auth.uid()) = '04ce4714-0567-4bc0-b2b7-2e940f87ff52'::uuid
  )
);

DROP POLICY IF EXISTS "admin_live_presence_write" ON "realtime"."messages";
CREATE POLICY "admin_live_presence_write"
ON "realtime"."messages" FOR INSERT TO authenticated
WITH CHECK (
  "extension" = 'presence'
  AND (SELECT realtime.topic()) = 'admin-live:' || (SELECT auth.uid())::text
  AND public.get_user_role((SELECT auth.uid())) IN (
    'Administration', 'Hotel Owner', 'Hotel Manager', 'Receptionist',
    'Housekeeper', 'Rishiraj-ji', 'Accountant'
  )
);

CREATE OR REPLACE FUNCTION public.get_admin_live_roster()
RETURNS TABLE ("id" uuid, "name" text, "email" text, "role" text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS DISTINCT FROM '04ce4714-0567-4bc0-b2b7-2e940f87ff52'::uuid
    OR NOT EXISTS (
      SELECT 1 FROM public.profiles p JOIN public.roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name IN (
        'Administration', 'Hotel Owner', 'Hotel Manager', 'Receptionist',
        'Housekeeper', 'Rishiraj-ji', 'Accountant'
      )
    ) THEN
    RAISE EXCEPTION 'Live activity access denied' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT p.id, coalesce(nullif(btrim(p.name), ''), u.email, 'Admin user'),
      coalesce(u.email, '')::text, r.name::text
    FROM public.profiles p
    JOIN public.roles r ON r.id = p.role_id
    JOIN auth.users u ON u.id = p.id
    WHERE r.name IN (
      'Administration', 'Hotel Owner', 'Hotel Manager', 'Receptionist',
      'Housekeeper', 'Rishiraj-ji', 'Accountant'
    )
    ORDER BY coalesce(nullif(btrim(p.name), ''), u.email, 'Admin user');
END;
$$;

REVOKE ALL ON FUNCTION public.get_admin_live_roster() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_live_roster() TO authenticated;
COMMIT;

-- ROLLBACK:
-- DROP POLICY IF EXISTS "admin_live_presence_read" ON "realtime"."messages";
-- DROP POLICY IF EXISTS "admin_live_presence_write" ON "realtime"."messages";
-- DROP FUNCTION IF EXISTS public.get_admin_live_roster();

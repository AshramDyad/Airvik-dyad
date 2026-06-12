-- Make "Administration" the true top-level super-admin role.
--
-- Verified live (project crdksiypusddfbsgvbhj) BEFORE writing this migration:
--   * Administration is already the highest hierarchy_level (6 > Hotel Owner 5), so it can
--     already manage every user/role. Hierarchy was never the bug.
--   * The real gap: Administration had only 44 of the 53 canonical permissions — it was
--     MISSING the 4 donation perms (which Hotel Owner has), the 4 seasonal_price perms, and
--     read:owner_overview. That is why "Administration felt weaker than Hotel Owner".
--   * Two admin_activity_logs RLS policies gate by role NAME and omit Administration, with no
--     permission-based fallback, so Administration was fully blocked from admin activity logs.
--
-- This migration is idempotent and NON-DESTRUCTIVE: it only ADDS permissions to Administration
-- (by union — nothing it already has is removed), raises Administration's hierarchy headroom,
-- and ADDS the Administration name to the two activity-log policies. No other role is changed.
--
-- The Rishiraj-ji over-permission finding is intentionally NOT touched (user decision).

SET search_path TO public;

BEGIN;

-- A1. Grant Administration the full canonical permission set (53), by UNION.
--     Source of truth: allPermissions in src/data/types.ts. Keep the two in sync.
UPDATE public.roles
SET permissions = ARRAY(
  SELECT DISTINCT unnest(
    coalesce(permissions, ARRAY[]::text[]) || ARRAY[
      'create:guest','read:guest','update:guest','delete:guest',
      'create:reservation','read:reservation','update:reservation','delete:reservation',
      'create:room','read:room','update:room','delete:room',
      'create:room_type','read:room_type','update:room_type','delete:room_type',
      'create:room_category','read:room_category','update:room_category','delete:room_category',
      'create:rate_plan','read:rate_plan','update:rate_plan','delete:rate_plan',
      'create:seasonal_price','read:seasonal_price','update:seasonal_price','delete:seasonal_price',
      'create:post','read:post','update:post','delete:post',
      'create:feedback','read:feedback','update:feedback','delete:feedback',
      'create:review','read:review','update:review','delete:review',
      'create:donation','read:donation','update:donation','delete:donation',
      'read:payment','update:payment',
      'read:report','update:setting',
      'create:user','read:user','update:user','delete:user',
      'read:owner_overview'
    ]::text[]
  )
)
WHERE name = 'Administration';

-- A2. Keep Administration unmistakably at the top of the hierarchy. All role checks are
--     relative (actor_level > target_level), so the literal value is irrelevant; this only
--     widens Administration's lead so a future custom role cannot accidentally rival it.
UPDATE public.roles
SET hierarchy_level = GREATEST(
  hierarchy_level,
  (SELECT COALESCE(MAX(hierarchy_level), 0) + 10 FROM public.roles WHERE name <> 'Administration')
)
WHERE name = 'Administration';

-- A3. Add Administration to the two admin_activity_logs policies (the only role-name gates
--     with no permission fallback). DROP IF EXISTS then recreate — safe and additive.
DROP POLICY IF EXISTS "Allow leadership to view admin activity logs" ON public.admin_activity_logs;
CREATE POLICY "Allow leadership to view admin activity logs"
  ON public.admin_activity_logs FOR SELECT TO authenticated
  USING (public.get_user_role(auth.uid()) = ANY (ARRAY['Administration','Hotel Owner','Hotel Manager']::text[]));

DROP POLICY IF EXISTS "Allow staff to create admin activity logs" ON public.admin_activity_logs;
CREATE POLICY "Allow staff to create admin activity logs"
  ON public.admin_activity_logs FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role(auth.uid()) = ANY (ARRAY['Administration','Hotel Owner','Hotel Manager','Receptionist','Housekeeper','Guest']::text[]));

COMMIT;

-- Post-apply check (expect Administration: perm_count = 53, hierarchy_level = highest):
--   SELECT name, hierarchy_level, cardinality(permissions) AS perm_count
--   FROM public.roles ORDER BY hierarchy_level DESC;
--
-- ROLLBACK (manual): the permission/hierarchy changes are additive and not auto-reversible;
-- to restore the prior activity-log policies, recreate them without 'Administration' in the
-- role arrays (see baseline migration 00000000000000_baseline.sql).

-- Add the view-only "Rishiraj-ji" role for the Owner Overview page.
--
-- This role carries a single new permission, 'read:owner_overview', which gates
-- ONLY the /admin/owner-overview page. It is intentionally NOT added to the
-- broad ADMIN_ROLES set in the app, so it cannot reach other admin APIs.
-- 'read:owner_overview' is a plain string in roles.permissions (text[]), so no
-- schema/enum change is needed.

SET search_path TO public;

BEGIN;

-- Create the Rishiraj-ji role (idempotent: only if missing).
-- ONLY this role gets 'read:owner_overview' — no other role sees the page,
-- matching the "access only for him" requirement.
INSERT INTO public.roles ("name", "permissions", "hierarchy_level")
SELECT 'Rishiraj-ji', ARRAY['read:owner_overview']::text[], 1
WHERE NOT EXISTS (
  SELECT 1 FROM public.roles WHERE "name" = 'Rishiraj-ji'
);

COMMIT;

-- ROLLBACK:
-- DELETE FROM public.roles WHERE "name" = 'Rishiraj-ji';

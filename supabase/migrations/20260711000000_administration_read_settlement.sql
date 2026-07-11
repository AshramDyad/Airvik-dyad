-- Keep "Administration" (the super-admin role) in sync with the permission catalog.
--
-- Why this migration exists:
--   Administration's "has every permission" is a STATIC hardcoded array written into its
--   roles.permissions row by 20260612000000_administration_super_admin.sql -- NOT a dynamic
--   "super-admin sees all" rule. hasPermission() is a literal permissions.includes(...).
--   So when a brand-new permission string is added to allPermissions (src/data/types.ts),
--   Administration does NOT receive it automatically and the gated feature stays hidden for it.
--
--   commit 518aeaa added 'read:settlement' to the catalog to gate the Settlements sub-menu.
--   This migration grants that one new string to Administration so the top role can see and
--   open Settlements. It cannot be done through the UI: role editing requires
--   actor_level > target_level (canManageRole + RLS user_can_manage_role), and Administration
--   is the top level, so it cannot edit its own role. SQL is the only path.
--
-- Idempotent and NON-DESTRUCTIVE: union only -- nothing Administration already has is removed.
--   Source of truth: allPermissions in src/data/types.ts. Keep the two in sync.

SET search_path TO public;

BEGIN;

UPDATE public.roles
SET permissions = ARRAY(
  SELECT DISTINCT unnest(
    coalesce(permissions, ARRAY[]::text[]) || ARRAY['read:settlement']::text[]
  )
)
WHERE name = 'Administration';

COMMIT;

-- Post-apply check (expect Administration to now include 'read:settlement'):
--   SELECT name, cardinality(permissions) AS perm_count,
--          'read:settlement' = ANY(permissions) AS has_settlement
--   FROM public.roles WHERE name = 'Administration';

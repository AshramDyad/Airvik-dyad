-- Allow admins to manage unassigned (role_id IS NULL) users.
--
-- Previously user_can_manage_user() returned FALSE whenever the target user had
-- no role, which made such users unmanageable: the delete-user edge function and
-- the profiles UPDATE/DELETE RLS policies both gate on this function, so a
-- role-less user could neither be deleted nor reassigned a role from the UI.
--
-- A user with no role has zero privileges and should sit below everyone. Any
-- actor that has a role (and the required delete:user / update:user permission,
-- still enforced separately by the edge function and RLS) may manage them.
-- Only the "target_role IS NULL" branch changes; behaviour for real roles is
-- unchanged (delegated to user_can_manage_role, which keeps the hierarchy check).

CREATE OR REPLACE FUNCTION "public"."user_can_manage_user"("actor_user_id" "uuid", "target_user_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  target_role uuid;
  actor_level integer;
BEGIN
  IF actor_user_id IS NULL OR target_user_id IS NULL OR actor_user_id = target_user_id THEN
    RETURN FALSE;
  END IF;

  SELECT role_id INTO target_role FROM public.profiles WHERE id = target_user_id;

  -- Unassigned (no role) users sit below everyone: any actor that has a role can manage them.
  -- Permission (delete:user / update:user) is still enforced by the caller (edge fn / RLS).
  IF target_role IS NULL THEN
    SELECT public.user_role_level(actor_user_id) INTO actor_level;
    RETURN actor_level IS NOT NULL;
  END IF;

  RETURN public.user_can_manage_role(actor_user_id, target_role);
END;
$$;

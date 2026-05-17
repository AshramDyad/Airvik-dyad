SET search_path TO public;

-- Ensure new Supabase Auth users receive an application profile.
CREATE OR REPLACE TRIGGER "on_auth_user_created"
  AFTER INSERT ON "auth"."users"
  FOR EACH ROW
  EXECUTE FUNCTION "public"."handle_new_user"();

-- ROLLBACK:
-- DROP TRIGGER IF EXISTS "on_auth_user_created" ON "auth"."users";

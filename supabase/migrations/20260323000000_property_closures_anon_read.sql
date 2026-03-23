-- Allow public (anon) users to read property closures for booking validation.
-- The existing policy only covers authenticated users; public booking pages
-- run as anon and need to fetch closures to disable blocked dates in calendars.
CREATE POLICY "Allow public read property closures"
  ON "public"."property_closures"
  FOR SELECT
  TO "authenticated", "anon"
  USING (true);

-- Audit remediation — anonymous-write lockdown + view RLS-bypass fix.
-- Findings H1 (anon INSERT) and C1 (bookings_summary_view portion).
--
-- This migration is GUARANTEED SAFE and idempotent. It deletes NO data and can
-- only remove access that is already proven unused. Verified against the codebase,
-- not assumed:
--
--   H1 — the ENTIRE public booking write path runs through SECURITY DEFINER RPCs
--   that execute as the (postgres) table owner and bypass RLS:
--     * guest:       src/app/(public)/book/review/page.tsx:515
--                    -> getOrCreateGuestByEmail (src/lib/api/index.ts:817)
--                    -> rpc get_or_create_booking_guest  [SECURITY DEFINER, baseline:744]
--     * reservation: review/page.tsx:555 -> context addReservation
--                    -> api.createReservationsWithTotal (index.ts:1030)
--                    -> rpc create_reservations_with_total [SECURITY DEFINER, baseline:315]
--   No FORCE ROW LEVEL SECURITY exists on any table (grep: none), so definer
--   functions genuinely bypass RLS. The only raw guests/reservations INSERT in the
--   code is api.addGuest (index.ts:843), called ONLY from the admin guests dialog
--   (guest-form-dialog.tsx:164) as an authenticated user — covered by the existing
--   "Guests require create permission" policy, not the anon policy dropped here.
--   Therefore removing the anon INSERT policies cannot break any flow.
--
--   bookings_summary_view — revoking the anon table grant is on its own sufficient
--   to close the anon read path: with no grant, anon gets permission-denied whether
--   the view is definer- or invoker-rights. This file therefore only REVOKEs the
--   anon grant (pure access removal, no change to read semantics). Verified there
--   are no DB-internal consumers of the view (grep of supabase/migrations: only the
--   view's own definition/owner/grants) and no application reader other than
--   service-role code (api/admin/reports/bookings/export/route.ts:27,
--   src/server/reservations/cache.ts:123/203/232). authenticated / service_role
--   grants are left untouched. The defense-in-depth security_invoker change is
--   deferred to the C1 batch, where it is applied and live-tested alongside the
--   underlying-table SELECT lockdown it complements.

begin;

set search_path to public;

-- H1: remove direct anonymous INSERT into guests / reservations.
drop policy if exists "anon_insert_guests" on public.guests;
drop policy if exists "anon_insert_reservations" on public.reservations;
drop policy if exists "Allow anonymous users to insert reservations" on public.reservations;

-- C1 (view portion): drop only the anon grant on the summary view.
revoke all on table public.bookings_summary_view from anon;

commit;

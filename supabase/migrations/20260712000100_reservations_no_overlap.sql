-- Audit remediation — finding H4: DB-level double-booking prevention.
--
-- Adds an exclusion constraint so two active reservations can never occupy the
-- same physical room for overlapping dates. This replaces the racy
-- SELECT-then-raise trigger (check_reservation_overlap) as the source of truth;
-- the trigger is intentionally KEPT for its friendly, room-numbered error message.
--
-- ============================ READ BEFORE APPLYING ============================
--
-- This migration DELETES NOTHING and is fully atomic (begin/commit): if the
-- ADD CONSTRAINT fails, the whole transaction rolls back and the table is left
-- exactly as it was. It cannot leave the schema half-changed.
--
-- It WILL fail (clean rollback) if the reservations table currently contains:
--   (a) two active rows overlapping on the same room, OR
--   (b) any row with check_out_date < check_in_date (daterange would error).
--
-- Case (a) is LIKELY in production right now because of finding H5 (abandoned
-- website holds were never released and keep blocking rooms). Run BOTH pre-flight
-- queries below in the Supabase SQL editor first. If either returns rows, resolve
-- them (typically by cancelling the stale holds — see the optional cleanup) and
-- then apply this migration.
--
-- The constraint predicate mirrors check_reservation_overlap() EXACTLY
-- (status not in ('Cancelled','No-show'); self-rows and null-room rows excluded),
-- so it never rejects anything the trigger already permitted — only the concurrent
-- race the trigger cannot catch.
--
-- Building the GiST index takes a brief ACCESS EXCLUSIVE lock on reservations
-- (sub-second for this dataset size). btree_gist + "uuid WITH =" are already proven
-- in this DB (seasonal_prices_no_overlap, tariffs_no_overlap use the same pattern).
--
-- ----------------------------- PRE-FLIGHT (a): overlaps ----------------------
-- select a.id as id_a, b.id as id_b, a.room_id, a.status as status_a,
--        b.status as status_b, a.check_in_date, a.check_out_date,
--        b.check_in_date as b_check_in, b.check_out_date as b_check_out
-- from public.reservations a
-- join public.reservations b
--   on a.room_id = b.room_id
--  and a.id < b.id
--  and a.status not in ('Cancelled','No-show')
--  and b.status not in ('Cancelled','No-show')
--  and daterange(a.check_in_date, a.check_out_date, '[)')
--      && daterange(b.check_in_date, b.check_out_date, '[)');
--
-- ----------------------------- PRE-FLIGHT (b): bad dates ----------------------
-- select id, room_id, status, check_in_date, check_out_date
-- from public.reservations
-- where check_out_date < check_in_date;
--
-- ------------------ OPTIONAL cleanup for stale website holds ------------------
-- Review the overlap rows first. Only if they are genuinely abandoned holds
-- (status in ('Room Hold','Pending') with no confirmed payment) should you cancel
-- the OLDER duplicate. Example (inspect before running — this DOES modify data):
--   -- update public.reservations set status = 'Cancelled'
--   -- where id in ( <ids of the stale holds identified above> );
-- =============================================================================

begin;

set search_path to public;

alter table public.reservations
  add constraint reservations_no_overlap
  exclude using gist (
    room_id with =,
    daterange(check_in_date, check_out_date, '[)') with &&
  )
  where (room_id is not null and status not in ('Cancelled', 'No-show'));

commit;

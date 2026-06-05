-- Add guestName to get_monthly_availability so the calendar can show the real
-- guest name without depending on the separately-loaded client `guests` list.
--
-- Why: the calendar bar resolves the name by looking up guestId in the context
-- `guests` list; on a slow/flaky connection that fetch can fail and the list
-- becomes empty, so every bar falls back to the literal "Guest". By returning
-- the name inside each roomReservations entry (the same payload that draws the
-- bar), the name travels with the booking and is immune to that failure -- the
-- same pattern the reservations list/popup already use (guest joined onto the row).
--
-- This is a CREATE OR REPLACE that copies the current definition verbatim and
-- adds only: (1) a LEFT JOIN to public.guests in reservations_in_scope, and
-- (2) a 'guestName' key in the roomReservations JSON. No other logic changes.

set search_path to public;

create or replace function public.get_monthly_availability(
  p_month_start date,
  p_room_type_ids uuid[] default null
)
returns table (
  room_type_id uuid,
  room_type jsonb,
  availability jsonb
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_month_start date := date_trunc('month', coalesce(p_month_start, current_date));
  v_month_end date := (date_trunc('month', coalesce(p_month_start, current_date)) + interval '1 month');
  v_allow_same_day boolean := true;
  v_property_id uuid;
  v_has_property_closures boolean := to_regclass('public.property_closures') is not null;
begin
  select id, allow_same_day_turnover
  into v_property_id, v_allow_same_day
  from public.properties
  order by id
  limit 1;

  v_allow_same_day := coalesce(v_allow_same_day, true);

  return query
  with rooms_by_type as (
    select
      rt.id as room_type_id,
      rt.name,
      rt.description,
      rt.max_occupancy,
      rt.min_occupancy,
      rt.main_photo_url,
      rt.price,
      count(r.id)::int as units,
      coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', r.id,
            'roomNumber', r.room_number
          )
          order by r.room_number
        ) filter (where r.id is not null),
        '[]'::jsonb
      ) as rooms_json
    from public.room_types rt
    left join public.rooms r on r.room_type_id = rt.id
    where (p_room_type_ids is null or rt.id = any(p_room_type_ids))
    group by rt.id
  ),
  days as (
    select generate_series(v_month_start, (v_month_end - interval '1 day')::date, interval '1 day')::date as day
  ),
  reservations_in_scope as (
    select
      res.id,
      res.guest_id,
      res.room_id,
      res.check_in_date,
      res.check_out_date,
      res.status,
      res.hold_expires_at,
      nullif(btrim(coalesce(g.first_name, '') || ' ' || coalesce(g.last_name, '')), '') as guest_name,
      rms.room_type_id
    from public.reservations res
    join public.rooms rms on rms.id = res.room_id
    left join public.guests g on g.id = res.guest_id
    where res.check_out_date > v_month_start
      and res.check_in_date < v_month_end
      and res.status not in ('Cancelled', 'No-show')
      and (p_room_type_ids is null or rms.room_type_id = any(p_room_type_ids))
  ),
  property_level_closures as (
    select
      pc.room_type_id,
      pc.start_date,
      pc.end_date
    from public.property_closures pc
    where v_has_property_closures
      and (v_property_id is null or pc.property_id = v_property_id)
      and pc.end_date >= v_month_start
      and pc.start_date < v_month_end
  ),
  seasonal_closures as (
    select
      br.room_type_id,
      coalesce(br.start_date, v_month_start) as start_date,
      coalesce(br.end_date, coalesce(br.start_date, v_month_start)) as end_date
    from public.booking_restrictions br
    where br.restriction_type = 'season'
      and coalesce((br.value ->> 'closed')::boolean, false)
      and coalesce(br.end_date, br.start_date, v_month_end) >= v_month_start
      and coalesce(br.start_date, v_month_start) < v_month_end
  ),
  closures as (
    select * from property_level_closures
    union all
    select * from seasonal_closures
  ),
  days_with_context as (
    select
      rbt.room_type_id,
      d.day,
      rbt.units,
      coalesce((
        select count(*)
        from reservations_in_scope ris
        where ris.room_type_id = rbt.room_type_id
          and d.day >= ris.check_in_date
          and d.day < ris.check_out_date
      ), 0) as active_bookings,
      coalesce((
        select array_agg(ris.id)
        from reservations_in_scope ris
        where ris.room_type_id = rbt.room_type_id
          and d.day >= ris.check_in_date
          and d.day < ris.check_out_date
      ), array[]::uuid[]) as reservation_ids,
      exists(
        select 1
        from reservations_in_scope ris
        where ris.room_type_id = rbt.room_type_id
          and d.day = ris.check_in_date
      ) as has_checkin,
      exists(
        select 1
        from reservations_in_scope ris
        where ris.room_type_id = rbt.room_type_id
          and d.day = ris.check_out_date
      ) as has_checkout,
      coalesce((
        select count(*)
        from reservations_in_scope ris
        where ris.room_type_id = rbt.room_type_id
          and d.day = ris.check_out_date
      ), 0) as checkout_count,
      exists(
        select 1
        from closures cl
        where (cl.room_type_id is null or cl.room_type_id = rbt.room_type_id)
          and d.day between cl.start_date and cl.end_date
      ) as is_closed
    from rooms_by_type rbt
    cross join days d
  ),
  summarized as (
    select
      dwc.room_type_id,
      dwc.day,
      dwc.units,
      dwc.reservation_ids,
      dwc.has_checkin,
      dwc.has_checkout,
      dwc.is_closed,
      case
        when dwc.is_closed then dwc.units
        when dwc.units = 0 then 0
        when not v_allow_same_day and dwc.units = 1 and dwc.checkout_count > 0 then greatest(dwc.active_bookings, 1)
        else dwc.active_bookings
      end as booked_effective
    from days_with_context dwc
  )
  select
    rbt.room_type_id,
    jsonb_build_object(
      'id', rbt.room_type_id,
      'name', rbt.name,
      'description', rbt.description,
      'mainPhotoUrl', rbt.main_photo_url,
      'price', rbt.price,
      'rooms', rbt.rooms_json,
      'units', rbt.units,
      'sharedInventory', (rbt.units > 1)
    ) as room_type,
    jsonb_agg(
      jsonb_build_object(
        'date', summarized.day,
        'status', case
          when summarized.units = 0 then 'closed'
          when summarized.is_closed then 'closed'
          when summarized.booked_effective = 0 then 'free'
          when summarized.booked_effective >= summarized.units then 'busy'
          else 'partial'
        end,
        'unitsTotal', summarized.units,
        'bookedCount', summarized.booked_effective,
        'reservationIds', to_jsonb(coalesce(summarized.reservation_ids, array[]::uuid[])),
        'hasCheckIn', summarized.has_checkin,
        'hasCheckOut', summarized.has_checkout,
        'isClosed', summarized.is_closed,
        'roomReservations', coalesce((
          select jsonb_object_agg(
            ris.room_id::text,
            jsonb_build_object(
              'reservationId', ris.id,
              'guestId', ris.guest_id,
              'guestName', ris.guest_name,
              'checkInDate', ris.check_in_date,
              'checkOutDate', ris.check_out_date,
              'status', ris.status
            )
          )
          from reservations_in_scope ris
          where ris.room_type_id = summarized.room_type_id
            and summarized.day >= ris.check_in_date
            and summarized.day < ris.check_out_date
        ), '{}'::jsonb)
      ) order by summarized.day
    ) as availability
  from rooms_by_type rbt
  join summarized on summarized.room_type_id = rbt.room_type_id
  group by rbt.room_type_id, rbt.name, rbt.description, rbt.main_photo_url, rbt.price, rbt.rooms_json, rbt.units
  order by rbt.name;
end;
$$;

-- ROLLBACK:
-- Re-apply the prior definition from
-- supabase/migrations/20260528090000_fix_room_hold_manual_release.sql
-- (the same function body without the `left join public.guests` and without the
-- 'guestName' key in the roomReservations jsonb_build_object).

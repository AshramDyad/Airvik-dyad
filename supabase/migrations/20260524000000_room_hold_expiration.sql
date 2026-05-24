begin;

set search_path to public;

alter table public.reservations
  add column if not exists hold_expires_at timestamptz;

update public.reservations
set
  status = 'Room Hold',
  hold_expires_at = coalesce(hold_expires_at, coalesce(booking_date, now()) + interval '30 minutes')
where status = 'Tentative';

create index if not exists reservations_room_hold_lookup_idx
  on public.reservations (room_id, check_in_date, check_out_date, status, hold_expires_at);

create or replace function public.check_reservation_overlap()
returns trigger
language plpgsql
as $$
declare
  v_conflict record;
begin
  if new.status = 'Room Hold' and new.hold_expires_at is null then
    new.hold_expires_at := now() + interval '30 minutes';
  end if;

  if new.status <> 'Room Hold' then
    new.hold_expires_at := null;
  end if;

  if new.status in ('Cancelled', 'No-show')
    or (new.status = 'Room Hold' and new.hold_expires_at <= now()) then
    return new;
  end if;

  select r.id, rm.room_number
  into v_conflict
  from public.reservations r
  join public.rooms rm on rm.id = r.room_id
  where r.room_id = new.room_id
    and r.id <> new.id
    and r.status not in ('Cancelled', 'No-show')
    and (
      r.status <> 'Room Hold'
      or (r.hold_expires_at is not null and r.hold_expires_at > now())
    )
    and daterange(r.check_in_date, r.check_out_date, '[)')
        && daterange(new.check_in_date, new.check_out_date, '[)')
  limit 1;

  if v_conflict is not null then
    raise exception 'Room % is already booked or on hold for the selected dates. Please choose different dates or another room.',
      v_conflict.room_number
      using errcode = '23P01';
  end if;

  return new;
end;
$$;

drop function if exists public.create_reservations_with_total(
  text,
  uuid,
  uuid[],
  uuid,
  date,
  date,
  integer,
  text,
  text,
  timestamp with time zone,
  text,
  text,
  integer,
  integer,
  boolean,
  numeric,
  numeric[]
);

create or replace function public.create_reservations_with_total(
  p_booking_id text,
  p_guest_id uuid,
  p_room_ids uuid[],
  p_rate_plan_id uuid,
  p_check_in_date date,
  p_check_out_date date,
  p_number_of_guests integer,
  p_status text,
  p_notes text default null::text,
  p_booking_date timestamp with time zone default now(),
  p_source text default 'website'::text,
  p_payment_method text default 'Not specified'::text,
  p_adult_count integer default 1,
  p_child_count integer default 0,
  p_hold_expires_at timestamp with time zone default null::timestamp with time zone,
  p_tax_enabled_snapshot boolean default false,
  p_tax_rate_snapshot numeric default 0,
  p_custom_totals numeric[] default null::numeric[]
)
returns setof public.reservations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nights int;
  v_rate numeric(10, 2);
  v_fallback numeric(10, 2);
  v_conflict record;
  v_booking_id text;
  v_hold_expires_at timestamptz;
begin
  if array_length(p_room_ids, 1) is null then
    raise exception 'room_ids array cannot be empty' using errcode = '22023';
  end if;

  if p_custom_totals is not null and
    array_length(p_custom_totals, 1) is distinct from array_length(p_room_ids, 1) then
    raise exception 'custom totals length must match number of rooms' using errcode = '22023';
  end if;

  if p_custom_totals is not null then
    for idx in 1..array_length(p_custom_totals, 1) loop
      if p_custom_totals[idx] is not null and p_custom_totals[idx] <= 0 then
        raise exception 'custom totals must be positive values' using errcode = '22023';
      end if;
    end loop;
  end if;

  v_booking_id := coalesce(
    nullif(trim(p_booking_id), ''),
    public.generate_booking_code()
  );

  v_hold_expires_at := case
    when p_status = 'Room Hold' then coalesce(p_hold_expires_at, now() + interval '30 minutes')
    else null
  end;

  if p_status not in ('Cancelled', 'No-show')
    and not (p_status = 'Room Hold' and v_hold_expires_at <= now()) then
    select r.room_id, rm.room_number
    into v_conflict
    from public.reservations r
    join public.rooms rm on rm.id = r.room_id
    where r.room_id = any(p_room_ids)
      and r.status not in ('Cancelled', 'No-show')
      and (
        r.status <> 'Room Hold'
        or (r.hold_expires_at is not null and r.hold_expires_at > now())
      )
      and daterange(r.check_in_date, r.check_out_date, '[)')
          && daterange(p_check_in_date, p_check_out_date, '[)')
    limit 1;
  end if;

  if v_conflict is not null then
    raise exception 'Room % is already booked or on hold for the selected dates. Please choose different dates or another room.',
      v_conflict.room_number
      using errcode = '23P01';
  end if;

  v_nights := greatest(p_check_out_date - p_check_in_date, 1);

  select price into v_rate
  from public.rate_plans
  where id = p_rate_plan_id;

  if v_rate is null or v_rate <= 0 then
    select rt.price
    into v_fallback
    from public.rooms r
    join public.room_types rt on rt.id = r.room_type_id
    where r.id = p_room_ids[1];

    if v_fallback is not null and v_fallback > 0 then
      v_rate := v_fallback;
    else
      v_rate := 3000;
    end if;
  end if;

  return query
  with room_pricing as (
    select
      rid.room_id,
      coalesce(
        case
          when p_custom_totals is not null
              and p_custom_totals[rid.ordinality] is not null
            then p_custom_totals[rid.ordinality]
          else null
        end,
        v_nights * (
          case
            when room_info.room_price is not null and room_info.room_price > 0
              then room_info.room_price
            else v_rate
          end
        )
      ) as total_amount
    from unnest(p_room_ids) with ordinality as rid(room_id, ordinality)
    left join lateral (
      select rt.price as room_price
      from public.rooms r
      join public.room_types rt on rt.id = r.room_type_id
      where r.id = rid.room_id
      limit 1
    ) as room_info on true
  )
  insert into public.reservations (
    booking_id,
    guest_id,
    room_id,
    rate_plan_id,
    check_in_date,
    check_out_date,
    number_of_guests,
    status,
    notes,
    total_amount,
    booking_date,
    source,
    payment_method,
    adult_count,
    child_count,
    hold_expires_at,
    tax_enabled_snapshot,
    tax_rate_snapshot
  )
  select
    v_booking_id,
    p_guest_id,
    room_pricing.room_id,
    p_rate_plan_id,
    p_check_in_date,
    p_check_out_date,
    p_number_of_guests,
    p_status,
    p_notes,
    room_pricing.total_amount,
    coalesce(p_booking_date, now()),
    coalesce(p_source, 'website'),
    coalesce(p_payment_method, 'Not specified'),
    greatest(p_adult_count, 1),
    greatest(p_child_count, 0),
    v_hold_expires_at,
    coalesce(p_tax_enabled_snapshot, false),
    coalesce(p_tax_rate_snapshot, 0)
  from room_pricing
  returning *;
end;
$$;

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
      rms.room_type_id
    from public.reservations res
    join public.rooms rms on rms.id = res.room_id
    where res.check_out_date > v_month_start
      and res.check_in_date < v_month_end
      and res.status not in ('Cancelled', 'No-show')
      and (
        res.status <> 'Room Hold'
        or (res.hold_expires_at is not null and res.hold_expires_at > now())
      )
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
              'checkInDate', ris.check_in_date,
              'checkOutDate', ris.check_out_date
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

create or replace view public.bookings_summary_view as
with filtered_reservations as (
  select
    r_1.id,
    r_1.booking_id,
    r_1.guest_id,
    r_1.room_id,
    r_1.rate_plan_id,
    r_1.check_in_date,
    r_1.check_out_date,
    r_1.number_of_guests,
    r_1.status,
    r_1.notes,
    r_1.total_amount,
    r_1.booking_date,
    r_1.source,
    r_1.payment_method,
    r_1.adult_count,
    r_1.child_count,
    r_1.hold_expires_at,
    r_1.tax_enabled_snapshot,
    r_1.tax_rate_snapshot,
    r_1.external_source,
    r_1.external_id,
    r_1.external_metadata,
    rooms.room_number as room_number_actual
  from public.reservations r_1
  left join public.rooms on r_1.room_id = rooms.id
  where r_1.external_metadata is null
    or (r_1.external_metadata ->> 'removedDuringEdit') is null
    or (r_1.external_metadata ->> 'removedDuringEdit') <> 'true'
)
select
  r.booking_id,
  min(r.booking_date) as booking_date,
  max(g.first_name) as guest_first_name,
  max(g.last_name) as guest_last_name,
  coalesce(max(g.first_name || ' ' || g.last_name), 'N/A') as guest_name,
  max(g.email) as guest_email,
  max(g.phone) as guest_phone,
  sum(r.total_amount) as total_amount,
  count(r.id) as room_count,
  min(r.check_in_date) as check_in_date,
  max(r.check_out_date) as check_out_date,
  sum(r.number_of_guests) as number_of_guests,
  sum(coalesce(r.adult_count, 0)) as adult_count,
  sum(coalesce(r.child_count, 0)) as child_count,
  (max(r.guest_id::text))::uuid as guest_id,
  case max(
    case r.status
      when 'Checked-out' then 5
      when 'Checked-in' then 4
      when 'Confirmed' then 3
      when 'Standby' then 2
      when 'Room Hold' then 1
      when 'Cancelled' then 0
      when 'No-show' then -1
      else -2
    end)
    when 5 then 'Checked-out'
    when 4 then 'Checked-in'
    when 3 then 'Confirmed'
    when 2 then 'Standby'
    when 1 then 'Room Hold'
    when 0 then 'Cancelled'
    when -1 then 'No-show'
    else 'Room Hold'
  end as status,
  jsonb_agg(jsonb_build_object(
    'id', r.id,
    'bookingId', r.booking_id,
    'guestId', r.guest_id,
    'roomId', r.room_id,
    'ratePlanId', r.rate_plan_id,
    'checkInDate', r.check_in_date,
    'checkOutDate', r.check_out_date,
    'numberOfGuests', r.number_of_guests,
    'status', r.status,
    'notes', r.notes,
    'totalAmount', r.total_amount,
    'bookingDate', r.booking_date,
    'source', r.source,
    'paymentMethod', r.payment_method,
    'adultCount', r.adult_count,
    'childCount', r.child_count,
    'holdExpiresAt', r.hold_expires_at,
    'taxEnabledSnapshot', r.tax_enabled_snapshot,
    'taxRateSnapshot', r.tax_rate_snapshot,
    'externalSource', r.external_source,
    'externalId', r.external_id,
    'externalMetadata', r.external_metadata,
    'roomNumber', r.room_number_actual,
    'folio', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', fi.id,
        'description', fi.description,
        'amount', fi.amount,
        'timestamp', fi.timestamp,
        'paymentMethod', fi.payment_method,
        'transactionId', fi.transaction_id,
        'externalSource', fi.external_source,
        'externalReference', fi.external_reference,
        'externalMetadata', fi.external_metadata
      ))
      from public.folio_items fi
      where fi.reservation_id = r.id
    ), '[]'::jsonb)
  )) as reservation_rows
from filtered_reservations r
left join public.guests g on r.guest_id = g.id
group by r.booking_id;

grant all on function public.create_reservations_with_total(
  text,
  uuid,
  uuid[],
  uuid,
  date,
  date,
  integer,
  text,
  text,
  timestamp with time zone,
  text,
  text,
  integer,
  integer,
  timestamp with time zone,
  boolean,
  numeric,
  numeric[]
) to anon, authenticated, service_role;

-- ROLLBACK:
-- create a new migration that restores the previous function/view definitions
-- from the pre-push schema backup, changes any desired 'Room Hold' rows back to
-- 'Tentative', drops public.reservations_room_hold_lookup_idx, and drops
-- public.reservations.hold_expires_at only after confirming no rollback data is needed.

commit;

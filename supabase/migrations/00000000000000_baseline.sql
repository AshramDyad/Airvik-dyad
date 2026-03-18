


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "btree_gist" WITH SCHEMA "public";






CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."feedback_status" AS ENUM (
    'new',
    'in_review',
    'resolved'
);


ALTER TYPE "public"."feedback_status" OWNER TO "postgres";


CREATE TYPE "public"."feedback_type" AS ENUM (
    'suggestion',
    'praise',
    'complaint',
    'question'
);


ALTER TYPE "public"."feedback_type" OWNER TO "postgres";


CREATE TYPE "public"."pricing_adjustment_type" AS ENUM (
    'percent',
    'fixed'
);


ALTER TYPE "public"."pricing_adjustment_type" OWNER TO "postgres";


CREATE TYPE "public"."pricing_guest_type" AS ENUM (
    'adult',
    'child'
);


ALTER TYPE "public"."pricing_guest_type" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calculate_booking_total"("p_room_type_id" "uuid", "p_rate_plan_id" "uuid", "p_check_in" "date", "p_check_out" "date", "p_adults" integer, "p_children" integer) RETURNS json
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_days INTEGER;
    v_base_total NUMERIC(10, 2) := 0;
    v_final_total NUMERIC(10, 2) := 0;
    v_daily_rate NUMERIC(10, 2) := 0;
    v_taxes NUMERIC(10, 2) := 0;
    
    v_season RECORD;
    v_occ_rule RECORD;
    
    v_current_date DATE;
    v_nightly_breakdown JSONB := '[]'::JSONB;
    v_night_cost NUMERIC(10, 2);
    
    v_found_grid_price BOOLEAN := FALSE;
    
    -- Fallback variables
    v_fallback_price NUMERIC(10, 2);
BEGIN
    -- 1. Validation
    IF p_check_out <= p_check_in THEN
        RAISE EXCEPTION 'Check-out date must be after check-in date';
    END IF;
    
    v_days := (p_check_out - p_check_in);
    
    -- 2. Base Rate Lookup (Priority: Grid -> Room Type Base Price)
    
    -- Try to find exact LOS match in Grid
    SELECT total_cost INTO v_base_total
    FROM public.pricing_rates_grid
    WHERE room_type_id = p_room_type_id
      AND (rate_plan_id = p_rate_plan_id OR (p_rate_plan_id IS NULL AND rate_plan_id IS NULL))
      AND days = v_days;
      
    IF FOUND THEN
        v_found_grid_price := TRUE;
        v_daily_rate := v_base_total / v_days;
    ELSE
        -- Fallback: Get simple base price from room_types or rate_plans
        -- Priority: Rate Plan Price -> Room Type Price -> 3000 (Default)
        
        -- Check Rate Plan Price
        IF p_rate_plan_id IS NOT NULL THEN
            SELECT price INTO v_daily_rate FROM public.rate_plans WHERE id = p_rate_plan_id;
        END IF;
        
        -- Check Room Type Price if Rate Plan didn't have one
        IF v_daily_rate IS NULL OR v_daily_rate = 0 THEN
            SELECT price INTO v_daily_rate FROM public.room_types WHERE id = p_room_type_id;
        END IF;
        
        -- Ultimate Fallback
        IF v_daily_rate IS NULL OR v_daily_rate = 0 THEN
            v_daily_rate := 3000; -- Default price in INR
        END IF;
        
        v_base_total := v_daily_rate * v_days;
    END IF;
    
    -- 3. Seasonal Adjustments (Iterate per night)
    v_current_date := p_check_in;
    v_final_total := 0;
    
    WHILE v_current_date < p_check_out LOOP
        v_night_cost := v_daily_rate;
        
        -- Check for matching seasons
        FOR v_season IN 
            SELECT * FROM public.pricing_seasons 
            WHERE start_date <= v_current_date 
              AND end_date >= v_current_date
              AND (room_type_id IS NULL OR room_type_id = p_room_type_id)
        LOOP
            IF v_season.adjustment_type = 'percent' THEN
                v_night_cost := v_night_cost + (v_daily_rate * (v_season.adjustment_value / 100));
            ELSE -- fixed
                v_night_cost := v_night_cost + v_season.adjustment_value;
            END IF;
        END LOOP;
        
        -- Accumulate
        v_final_total := v_final_total + v_night_cost;
        
        -- Add to breakdown
        v_nightly_breakdown := v_nightly_breakdown || jsonb_build_object(
            'date', v_current_date,
            'cost', v_night_cost
        );
        
        v_current_date := v_current_date + 1;
    END LOOP;
    
    -- 4. Occupancy Adjustments (Applied to the Final Total or Per Night? VikBooking usually per night, but lets apply to total for simplicity if strictly following simple rules, or iterate again. Let's apply to Total for now as a post-calc modifier)
    
    -- Adult rules
    FOR v_occ_rule IN 
        SELECT * FROM public.pricing_occupancy_rules 
        WHERE room_type_id = p_room_type_id 
          AND guest_type = 'adult' 
          AND guest_count = p_adults
    LOOP
         IF v_occ_rule.adjustment_type = 'percent' THEN
                v_final_total := v_final_total + (v_final_total * (v_occ_rule.adjustment_value / 100));
            ELSE -- fixed (usually fixed amount per stay OR per night - assuming per stay for simplicity unless 'per night' logic is preferred. VikBooking usually does per night for occupancy. Let's assume fixed value is TOTAL for the stay for this prototype to avoid complexity, or strictly interpret as 'per night' if we multiplied. Let's stick to: Percent is on Total, Fixed is added to Total)
                v_final_total := v_final_total + v_occ_rule.adjustment_value;
            END IF;
    END LOOP;
    
     -- Child rules
    FOR v_occ_rule IN 
        SELECT * FROM public.pricing_occupancy_rules 
        WHERE room_type_id = p_room_type_id 
          AND guest_type = 'child' 
          AND guest_count = p_children
    LOOP
         IF v_occ_rule.adjustment_type = 'percent' THEN
                v_final_total := v_final_total + (v_final_total * (v_occ_rule.adjustment_value / 100));
            ELSE 
                v_final_total := v_final_total + v_occ_rule.adjustment_value;
            END IF;
    END LOOP;

    -- 5. Taxes
    v_taxes := v_final_total * 0.18; -- 18% Tax hardcoded as per previous system
    
    RETURN json_build_object(
        'base_daily_rate', v_daily_rate,
        'total_cost_before_tax', v_final_total,
        'taxes', v_taxes,
        'grand_total', v_final_total + v_taxes,
        'nights', v_days,
        'nightly_breakdown', v_nightly_breakdown
    );
END;
$$;


ALTER FUNCTION "public"."calculate_booking_total"("p_room_type_id" "uuid", "p_rate_plan_id" "uuid", "p_check_in" "date", "p_check_out" "date", "p_adults" integer, "p_children" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_reservation_overlap"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_conflict record;
BEGIN
  -- Skip check for cancelled / no-show reservations
  IF NEW.status IN ('Cancelled', 'No-show') THEN
    RETURN NEW;
  END IF;

  SELECT r.id, rm.room_number
  INTO v_conflict
  FROM public.reservations r
  JOIN public.rooms rm ON rm.id = r.room_id
  WHERE r.room_id = NEW.room_id
    AND r.id <> NEW.id
    AND r.status NOT IN ('Cancelled', 'No-show')
    AND daterange(r.check_in_date, r.check_out_date, '[)')
        && daterange(NEW.check_in_date, NEW.check_out_date, '[)')
  LIMIT 1;

  IF v_conflict IS NOT NULL THEN
    RAISE EXCEPTION 'Room % is already booked for the selected dates. Please choose different dates or another room.',
      v_conflict.room_number
      USING ERRCODE = '23P01';
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."check_reservation_overlap"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."reservations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "booking_id" "text" NOT NULL,
    "guest_id" "uuid",
    "room_id" "uuid",
    "rate_plan_id" "uuid",
    "check_in_date" "date" NOT NULL,
    "check_out_date" "date" NOT NULL,
    "number_of_guests" integer NOT NULL,
    "status" "text" NOT NULL,
    "notes" "text",
    "total_amount" numeric(10,2) NOT NULL,
    "booking_date" timestamp with time zone DEFAULT "now"(),
    "source" "text",
    "payment_method" "text" DEFAULT 'Not specified'::"text" NOT NULL,
    "adult_count" integer DEFAULT 1 NOT NULL,
    "child_count" integer DEFAULT 0 NOT NULL,
    "tax_enabled_snapshot" boolean DEFAULT false NOT NULL,
    "tax_rate_snapshot" numeric(5,4) DEFAULT 0 NOT NULL,
    "external_source" "text" DEFAULT 'internal'::"text" NOT NULL,
    "external_id" "text",
    "external_metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    CONSTRAINT "reservations_booking_id_format" CHECK (("booking_id" ~ '^A[0-9]+$'::"text"))
);


ALTER TABLE "public"."reservations" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_reservations_with_total"("p_booking_id" "text", "p_guest_id" "uuid", "p_room_ids" "uuid"[], "p_rate_plan_id" "uuid", "p_check_in_date" "date", "p_check_out_date" "date", "p_number_of_guests" integer, "p_status" "text", "p_notes" "text" DEFAULT NULL::"text", "p_booking_date" timestamp with time zone DEFAULT "now"(), "p_source" "text" DEFAULT 'website'::"text", "p_payment_method" "text" DEFAULT 'Not specified'::"text", "p_adult_count" integer DEFAULT 1, "p_child_count" integer DEFAULT 0, "p_tax_enabled_snapshot" boolean DEFAULT false, "p_tax_rate_snapshot" numeric DEFAULT 0, "p_custom_totals" numeric[] DEFAULT NULL::numeric[]) RETURNS SETOF "public"."reservations"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_nights      int;
  v_rate        numeric(10, 2);
  v_fallback    numeric(10, 2);
  v_conflict    record;
  v_booking_id  text;   -- FIX: generate ONCE and reuse for ALL rooms
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

  -- FIX: Generate or use provided booking_id ONCE before the INSERT.
  -- This ensures all rooms in a multi-room booking share the SAME booking_id.
  v_booking_id := coalesce(
    nullif(trim(p_booking_id), ''),
    public.generate_booking_code()
  );

  -- Pre-check for overlapping reservations (friendly error message).
  select r.room_id, rm.room_number
  into v_conflict
  from public.reservations r
  join public.rooms rm on rm.id = r.room_id
  where r.room_id = any(p_room_ids)
    and r.status not in ('Cancelled', 'No-show')
    and daterange(r.check_in_date, r.check_out_date, '[)')
        && daterange(p_check_in_date, p_check_out_date, '[)')
  limit 1;

  if v_conflict is not null then
    raise exception 'Room % is already booked for the selected dates. Please choose different dates or another room.',
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
    tax_enabled_snapshot,
    tax_rate_snapshot
  )
  select
    v_booking_id,          -- FIX: use the SAME booking_id for ALL rooms
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
    coalesce(p_tax_enabled_snapshot, false),
    coalesce(p_tax_rate_snapshot, 0)
  from room_pricing
  returning *;
end;
$$;


ALTER FUNCTION "public"."create_reservations_with_total"("p_booking_id" "text", "p_guest_id" "uuid", "p_room_ids" "uuid"[], "p_rate_plan_id" "uuid", "p_check_in_date" "date", "p_check_out_date" "date", "p_number_of_guests" integer, "p_status" "text", "p_notes" "text", "p_booking_date" timestamp with time zone, "p_source" "text", "p_payment_method" "text", "p_adult_count" integer, "p_child_count" integer, "p_tax_enabled_snapshot" boolean, "p_tax_rate_snapshot" numeric, "p_custom_totals" numeric[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_booking_code"() RETURNS "text"
    LANGUAGE "sql"
    AS $$
  SELECT 'A' || nextval('public.booking_code_seq')::text;
$$;


ALTER FUNCTION "public"."generate_booking_code"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_monthly_availability"("p_month_start" "date", "p_room_type_ids" "uuid"[] DEFAULT NULL::"uuid"[]) RETURNS TABLE("room_type_id" "uuid", "room_type" "jsonb", "availability" "jsonb")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_month_start date := date_trunc('month', coalesce(p_month_start, current_date));
  v_month_end date := (date_trunc('month', coalesce(p_month_start, current_date)) + interval '1 month');
  v_allow_same_day boolean := true;
  v_property_id uuid;
  v_has_property_closures boolean := to_regclass('public.property_closures') is not null;
begin
  -- Use order by id instead of created_at for deterministic property selection
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
      res.room_id,
      res.check_in_date,
      res.check_out_date,
      res.status,
      rms.room_type_id
    from public.reservations res
    join public.rooms rms on rms.id = res.room_id
    where res.check_out_date > v_month_start
      and res.check_in_date < v_month_end
      and res.status <> 'Cancelled'
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
        'isClosed', summarized.is_closed
      ) order by summarized.day
    ) as availability
  from rooms_by_type rbt
  join summarized on summarized.room_type_id = rbt.room_type_id
  group by rbt.room_type_id, rbt.name, rbt.description, rbt.main_photo_url, rbt.price, rbt.rooms_json, rbt.units
  order by rbt.name;
end;
$$;


ALTER FUNCTION "public"."get_monthly_availability"("p_month_start" "date", "p_room_type_ids" "uuid"[]) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_monthly_availability"("p_month_start" "date", "p_room_type_ids" "uuid"[]) IS 'Aggregates per-room-type availability with LEFT JOIN to include room types without rooms. Shows all configured room types regardless of whether they have units assigned.';



CREATE TABLE IF NOT EXISTS "public"."guests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "first_name" "text" NOT NULL,
    "last_name" "text" NOT NULL,
    "email" "text",
    "phone" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "address" "text",
    "pincode" "text",
    "city" "text",
    "country" "text",
    "state" "text"
);


ALTER TABLE "public"."guests" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_or_create_booking_guest"("p_first_name" "text", "p_last_name" "text", "p_email" "text", "p_phone" "text", "p_address" "text" DEFAULT NULL::"text", "p_pincode" "text" DEFAULT NULL::"text", "p_city" "text" DEFAULT NULL::"text", "p_country" "text" DEFAULT NULL::"text") RETURNS "public"."guests"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_guest public.guests;
  v_email text;
begin
  v_email := nullif(btrim(p_email), '');

  if v_email is null then
    insert into public.guests (first_name, last_name, email, phone, address, pincode, city, country)
    values (
      nullif(btrim(p_first_name), ''),
      nullif(btrim(p_last_name), ''),
      null,
      nullif(btrim(p_phone), ''),
      nullif(btrim(p_address), ''),
      nullif(btrim(p_pincode), ''),
      nullif(btrim(p_city), ''),
      nullif(btrim(p_country), '')
    )
    returning * into v_guest;

    return v_guest;
  end if;

  insert into public.guests (first_name, last_name, email, phone, address, pincode, city, country)
  values (
    nullif(btrim(p_first_name), ''),
    nullif(btrim(p_last_name), ''),
    v_email,
    nullif(btrim(p_phone), ''),
    nullif(btrim(p_address), ''),
    nullif(btrim(p_pincode), ''),
    nullif(btrim(p_city), ''),
    nullif(btrim(p_country), '')
  )
  on conflict (email) do update
    set first_name = excluded.first_name,
        last_name = excluded.last_name,
        phone = excluded.phone,
        address = excluded.address,
        pincode = excluded.pincode,
        city = excluded.city,
        country = excluded.country
  returning * into v_guest;

  return v_guest;
end;
$$;


ALTER FUNCTION "public"."get_or_create_booking_guest"("p_first_name" "text", "p_last_name" "text", "p_email" "text", "p_phone" "text", "p_address" "text", "p_pincode" "text", "p_city" "text", "p_country" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_or_create_booking_guest"("p_first_name" "text", "p_last_name" "text", "p_email" "text", "p_phone" "text", "p_address" "text" DEFAULT NULL::"text", "p_pincode" "text" DEFAULT NULL::"text", "p_city" "text" DEFAULT NULL::"text", "p_state" "text" DEFAULT NULL::"text", "p_country" "text" DEFAULT NULL::"text") RETURNS "public"."guests"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_guest public.guests;
  v_email text;
begin
  v_email := nullif(btrim(p_email), '');

  if v_email is null then
    insert into public.guests (first_name, last_name, email, phone, address, pincode, city, state, country)
    values (
      nullif(btrim(p_first_name), ''),
      nullif(btrim(p_last_name), ''),
      null,
      nullif(btrim(p_phone), ''),
      nullif(btrim(p_address), ''),
      nullif(btrim(p_pincode), ''),
      nullif(btrim(p_city), ''),
      nullif(btrim(p_state), ''),
      nullif(btrim(p_country), '')
    )
    returning * into v_guest;

    return v_guest;
  end if;

  insert into public.guests (first_name, last_name, email, phone, address, pincode, city, state, country)
  values (
    nullif(btrim(p_first_name), ''),
    nullif(btrim(p_last_name), ''),
    v_email,
    nullif(btrim(p_phone), ''),
    nullif(btrim(p_address), ''),
    nullif(btrim(p_pincode), ''),
    nullif(btrim(p_city), ''),
    nullif(btrim(p_state), ''),
    nullif(btrim(p_country), '')
  )
  on conflict (email) do update
    set first_name = excluded.first_name,
        last_name = excluded.last_name,
        phone = excluded.phone,
        address = excluded.address,
        pincode = excluded.pincode,
        city = excluded.city,
        state = excluded.state,
        country = excluded.country
  returning * into v_guest;

  return v_guest;
end;
$$;


ALTER FUNCTION "public"."get_or_create_booking_guest"("p_first_name" "text", "p_last_name" "text", "p_email" "text", "p_phone" "text", "p_address" "text", "p_pincode" "text", "p_city" "text", "p_state" "text", "p_country" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_or_create_guest"("p_first_name" "text", "p_last_name" "text", "p_email" "text", "p_phone" "text") RETURNS "public"."guests"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_guest public.guests;
begin
  -- Insert or update the guest so the most recent booking details win
  insert into public.guests (first_name, last_name, email, phone)
  values (p_first_name, p_last_name, p_email, p_phone)
  on conflict (email) do update
    set first_name = excluded.first_name,
        last_name  = excluded.last_name,
        phone      = excluded.phone;

  select *
  into v_guest
  from public.guests
  where email = p_email
  limit 1;

  if v_guest.id is null then
    raise exception 'Failed to get or create guest for %', p_email using errcode = 'P0001';
  end if;

  return v_guest;
end;
$$;


ALTER FUNCTION "public"."get_or_create_guest"("p_first_name" "text", "p_last_name" "text", "p_email" "text", "p_phone" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_pricing_matrix"("p_room_type_ids" "uuid"[], "p_start" "date", "p_end" "date") RETURNS TABLE("room_type_id" "uuid", "rate_plan_id" "uuid", "day" "date", "nightly_rate" numeric, "min_stay" integer, "max_stay" integer, "cta" boolean, "ctd" boolean, "closed" boolean)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
WITH bounds AS (
  SELECT p_start::date AS start_date, p_end::date AS end_date
  WHERE p_start IS NOT NULL
    AND p_end IS NOT NULL
    AND p_end > p_start
),
calendar AS (
  SELECT day::date
  FROM bounds,
  LATERAL generate_series(bounds.start_date, bounds.end_date - INTERVAL '1 day', INTERVAL '1 day') AS day
),
room_plans AS (
  SELECT
    rrp.id,
    rrp.room_type_id,
    rrp.rate_plan_id,
    rrp.base_price,
    rrp.is_primary,
    rrp.created_at,
    ROW_NUMBER() OVER (
      PARTITION BY rrp.room_type_id
      ORDER BY rrp.is_primary DESC, rrp.created_at, rrp.id
    ) AS plan_rank
  FROM public.room_rate_plans rrp
  WHERE rrp.room_type_id = ANY(COALESCE(p_room_type_ids, ARRAY[]::uuid[]))
)
SELECT
  rp.room_type_id,
  rp.rate_plan_id,
  cal.day,
  COALESCE(season.price_override, rp.base_price)::numeric(10, 2) AS nightly_rate,
  season.min_stay,
  season.max_stay,
  season.cta,
  season.ctd,
  COALESCE(closed_dates.closed, false) AS closed
FROM room_plans AS rp
CROSS JOIN calendar AS cal
LEFT JOIN LATERAL (
  SELECT s.price_override, s.min_stay, s.max_stay, s.cta, s.ctd
  FROM public.rate_plan_seasons AS s
  WHERE s.room_type_id = rp.room_type_id
    AND s.rate_plan_id = rp.rate_plan_id
    AND cal.day BETWEEN s.start_date AND s.end_date
  ORDER BY s.start_date DESC, s.end_date DESC, s.created_at DESC, s.id DESC
  LIMIT 1
) AS season ON true
LEFT JOIN LATERAL (
  SELECT true AS closed
  FROM public.rate_plan_closed_dates AS cd
  WHERE cd.room_type_id = rp.room_type_id
    AND cd.rate_plan_id = rp.rate_plan_id
    AND cd.closed_on = cal.day
  LIMIT 1
) AS closed_dates ON true
ORDER BY rp.room_type_id, rp.plan_rank, rp.rate_plan_id, cal.day;
$$;


ALTER FUNCTION "public"."get_pricing_matrix"("p_room_type_ids" "uuid"[], "p_start" "date", "p_end" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_total_bookings"() RETURNS integer
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select coalesce(count(distinct booking_id), 0)::integer
  from public.reservations;
$$;


ALTER FUNCTION "public"."get_total_bookings"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_role"("user_id" "uuid") RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  role_name TEXT;
BEGIN
  SELECT r.name INTO role_name
  FROM public.profiles p
  JOIN public.roles r ON p.role_id = r.id
  WHERE p.id = user_id;
  RETURN role_name;
END;
$$;


ALTER FUNCTION "public"."get_user_role"("user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_donations_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_donations_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  role_id_to_assign UUID;
  provided_role_name TEXT;
BEGIN
  provided_role_name := new.raw_user_meta_data ->> 'role_name';
  IF provided_role_name IS NOT NULL THEN
    SELECT id INTO role_id_to_assign FROM public.roles WHERE name = provided_role_name;
  END IF;

  IF role_id_to_assign IS NULL THEN
    SELECT id INTO role_id_to_assign FROM public.roles WHERE name = 'Guest';
  END IF;

  INSERT INTO public.profiles (id, name, role_id)
  VALUES (new.id, new.raw_user_meta_data ->> 'name', role_id_to_assign);
  RETURN new;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."import_vikbooking_payload"("p_job_id" "uuid", "p_rows" "jsonb", "p_mark_complete" boolean DEFAULT false) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $$
DECLARE
  v_row jsonb;
  v_guest jsonb;
  v_reservation jsonb;
  v_folio jsonb;
  v_activity jsonb;
  v_entry_id uuid;
  v_guest_row public.guests;
  v_guest_id uuid;
  v_reservation_id uuid;
  v_existing_id uuid;
  v_processed integer := 0;
  v_errors integer := 0;
  v_error_message text;
  v_job_creator uuid;
  v_external_source text;
  v_external_id text;
BEGIN
  IF p_job_id IS NULL THEN
    RAISE EXCEPTION 'p_job_id is required';
  END IF;

  IF p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' THEN
    RAISE EXCEPTION 'p_rows must be a JSON array';
  END IF;

  SELECT created_by
    INTO v_job_creator
  FROM public.import_jobs
  WHERE id = p_job_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Import job % not found', p_job_id;
  END IF;

  FOR v_row IN SELECT * FROM jsonb_array_elements(p_rows) LOOP
    v_entry_id := NULL;
    BEGIN
      v_entry_id := (v_row ->> 'job_entry_id')::uuid;
      v_guest := coalesce(v_row -> 'guest', '{}'::jsonb);
      v_reservation := coalesce(v_row -> 'reservation', '{}'::jsonb);
      v_activity := v_row -> 'activity';

      IF v_reservation ->> 'room_id' IS NULL THEN
        RAISE EXCEPTION 'Room id is required in reservation payload';
      END IF;

      v_external_source := coalesce(v_reservation ->> 'external_source', 'vikbooking');
      v_external_id := v_reservation ->> 'external_id';

      IF v_external_id IS NULL THEN
        RAISE EXCEPTION 'External id is required for imported reservations';
      END IF;

      v_guest_row := public.get_or_create_guest(
        coalesce(v_guest ->> 'first_name', 'Guest'),
        coalesce(v_guest ->> 'last_name', v_external_id),
        coalesce(v_guest ->> 'email', concat('guest-', v_external_id, '@example.invalid')),
        coalesce(v_guest ->> 'phone', '')
      );
      v_guest_id := v_guest_row.id;

      -- Try insert, fallback to update when duplicate external reference exists.
      BEGIN
        INSERT INTO public.reservations (
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
          tax_enabled_snapshot,
          tax_rate_snapshot,
          external_source,
          external_id,
          external_metadata
        )
        VALUES (
          v_reservation ->> 'booking_id',
          v_guest_id,
          (v_reservation ->> 'room_id')::uuid,
          NULLIF(v_reservation ->> 'rate_plan_id', '')::uuid,
          (v_reservation ->> 'check_in_date')::date,
          (v_reservation ->> 'check_out_date')::date,
          coalesce((v_reservation ->> 'number_of_guests')::int, 1),
          v_reservation ->> 'status',
          v_reservation ->> 'notes',
          coalesce((v_reservation ->> 'total_amount')::numeric, 0),
          COALESCE((v_reservation ->> 'booking_date')::timestamptz, timezone('utc'::text, now())),
          coalesce(v_reservation ->> 'source', 'vikbooking'),
          coalesce(v_reservation ->> 'payment_method', 'Not specified'),
          coalesce((v_reservation ->> 'adult_count')::int, 1),
          coalesce((v_reservation ->> 'child_count')::int, 0),
          coalesce((v_reservation ->> 'tax_enabled_snapshot')::boolean, false),
          coalesce((v_reservation ->> 'tax_rate_snapshot')::numeric, 0),
          v_external_source,
          v_external_id,
          coalesce(v_reservation -> 'external_metadata', '{}'::jsonb)
        )
        RETURNING id INTO v_reservation_id;
      EXCEPTION WHEN unique_violation THEN
        UPDATE public.reservations
          SET
            guest_id = v_guest_id,
            rate_plan_id = NULLIF(v_reservation ->> 'rate_plan_id', '')::uuid,
            check_in_date = (v_reservation ->> 'check_in_date')::date,
            check_out_date = (v_reservation ->> 'check_out_date')::date,
            number_of_guests = coalesce((v_reservation ->> 'number_of_guests')::int, 1),
            status = v_reservation ->> 'status',
            notes = v_reservation ->> 'notes',
            total_amount = coalesce((v_reservation ->> 'total_amount')::numeric, 0),
            booking_date = COALESCE((v_reservation ->> 'booking_date')::timestamptz, timezone('utc'::text, now())),
            source = coalesce(v_reservation ->> 'source', 'vikbooking'),
            payment_method = coalesce(v_reservation ->> 'payment_method', 'Not specified'),
            adult_count = coalesce((v_reservation ->> 'adult_count')::int, 1),
            child_count = coalesce((v_reservation ->> 'child_count')::int, 0),
            tax_enabled_snapshot = coalesce((v_reservation ->> 'tax_enabled_snapshot')::boolean, false),
            tax_rate_snapshot = coalesce((v_reservation ->> 'tax_rate_snapshot')::numeric, 0),
            external_metadata = coalesce(v_reservation -> 'external_metadata', '{}'::jsonb)
        WHERE external_source = v_external_source
          AND external_id = v_external_id
          AND room_id = (v_reservation ->> 'room_id')::uuid
        RETURNING id INTO v_reservation_id;

        IF v_reservation_id IS NULL THEN
          RAISE EXCEPTION 'Failed to upsert reservation for %', v_external_id;
        END IF;
      END;

      -- Sync folio items for this reservation
      FOR v_folio IN SELECT * FROM jsonb_array_elements(COALESCE(v_row -> 'folio_items', '[]'::jsonb)) LOOP
        INSERT INTO public.folio_items (
          reservation_id,
          description,
          amount,
          timestamp,
          payment_method,
          external_source,
          external_reference,
          external_metadata
        )
        VALUES (
          v_reservation_id,
          v_folio ->> 'description',
          coalesce((v_folio ->> 'amount')::numeric, 0),
          COALESCE((v_folio ->> 'timestamp')::timestamptz, timezone('utc'::text, now())),
          v_folio ->> 'payment_method',
          coalesce(v_folio ->> 'external_source', v_external_source),
          v_folio ->> 'external_reference',
          coalesce(v_folio -> 'external_metadata', '{}'::jsonb)
        )
        ON CONFLICT (reservation_id, external_source, external_reference)
        DO UPDATE SET
          description = EXCLUDED.description,
          amount = EXCLUDED.amount,
          timestamp = EXCLUDED.timestamp,
          payment_method = EXCLUDED.payment_method,
          external_metadata = EXCLUDED.external_metadata;
      END LOOP;

      IF v_activity IS NOT NULL AND v_job_creator IS NOT NULL THEN
        PERFORM public.log_admin_activity_rpc(
          v_job_creator,
          'reservations',
          'reservation_imported',
          v_activity ->> 'actor_role',
          v_activity ->> 'actor_name',
          'reservation',
          v_reservation_id,
          v_reservation ->> 'booking_id',
          coalesce(v_activity ->> 'details', 'Imported via VikBooking CSV'),
          NULL,
          jsonb_build_object(
            'job_id', p_job_id,
            'external_id', v_external_id,
            'source', v_external_source
          )
        );
      END IF;

      v_processed := v_processed + 1;

      IF v_entry_id IS NOT NULL THEN
        UPDATE public.import_job_entries
        SET status = 'imported',
            message = NULL,
            payload = v_row,
            updated_at = timezone('utc'::text, now())
        WHERE id = v_entry_id;
      END IF;

    EXCEPTION WHEN OTHERS THEN
      v_errors := v_errors + 1;
      v_error_message := coalesce(SQLERRM, 'Unknown import error');
      IF v_entry_id IS NOT NULL THEN
        UPDATE public.import_job_entries
        SET status = 'error',
            message = v_error_message,
            payload = v_row,
            updated_at = timezone('utc'::text, now())
        WHERE id = v_entry_id;
      END IF;
    END;
  END LOOP;

  UPDATE public.import_jobs
  SET
    processed_rows = processed_rows + v_processed,
    error_rows = error_rows + v_errors,
    status = CASE
      WHEN p_mark_complete AND v_errors > 0 THEN 'failed'
      WHEN p_mark_complete THEN 'completed'
      ELSE 'running'
    END,
    completed_at = CASE WHEN p_mark_complete THEN timezone('utc'::text, now()) ELSE completed_at END,
    last_error = CASE WHEN v_errors > 0 THEN 'One or more rows failed during import' ELSE last_error END
  WHERE id = p_job_id;

  RETURN jsonb_build_object(
    'processed', v_processed,
    'errors', v_errors
  );
END;
$$;


ALTER FUNCTION "public"."import_vikbooking_payload"("p_job_id" "uuid", "p_rows" "jsonb", "p_mark_complete" boolean) OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."admin_activity_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "actor_user_id" "uuid",
    "actor_role" "text" DEFAULT 'Unknown Role'::"text" NOT NULL,
    "actor_name" "text",
    "section" "text" NOT NULL,
    "entity_type" "text",
    "entity_id" "uuid",
    "entity_label" "text",
    "action" "text" NOT NULL,
    "details" "text",
    "amount_minor" bigint,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."admin_activity_logs" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_admin_activity_rpc"("p_actor_user_id" "uuid", "p_section" "text", "p_action" "text", "p_actor_role" "text" DEFAULT NULL::"text", "p_actor_name" "text" DEFAULT NULL::"text", "p_entity_type" "text" DEFAULT NULL::"text", "p_entity_id" "uuid" DEFAULT NULL::"uuid", "p_entity_label" "text" DEFAULT NULL::"text", "p_details" "text" DEFAULT NULL::"text", "p_amount_minor" bigint DEFAULT NULL::bigint, "p_metadata" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "public"."admin_activity_logs"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $$
declare
  resolved_role text := p_actor_role;
  resolved_name text := p_actor_name;
  inserted_row public.admin_activity_logs;
begin
  if p_actor_user_id is null then
    raise exception 'actor_user_id is required';
  end if;

  if resolved_role is null then
    select r.name
      into resolved_role
    from public.profiles pr
    left join public.roles r on r.id = pr.role_id
    where pr.id = p_actor_user_id;

    if resolved_role is null then
      resolved_role := 'Unknown Role';
    end if;
  end if;

  if resolved_name is null then
    select coalesce(pr.name, au.email, 'Unknown User')
      into resolved_name
    from public.profiles pr
    left join auth.users au on au.id = pr.id
    where pr.id = p_actor_user_id;

    if resolved_name is null then
      resolved_name := 'Unknown User';
    end if;
  end if;

  insert into public.admin_activity_logs (
    actor_user_id,
    actor_role,
    actor_name,
    section,
    entity_type,
    entity_id,
    entity_label,
    action,
    details,
    amount_minor,
    metadata
  )
  values (
    p_actor_user_id,
    resolved_role,
    resolved_name,
    p_section,
    p_entity_type,
    p_entity_id,
    p_entity_label,
    p_action,
    p_details,
    p_amount_minor,
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning * into inserted_row;

  return inserted_row;
end;
$$;


ALTER FUNCTION "public"."log_admin_activity_rpc"("p_actor_user_id" "uuid", "p_section" "text", "p_action" "text", "p_actor_role" "text", "p_actor_name" "text", "p_entity_type" "text", "p_entity_id" "uuid", "p_entity_label" "text", "p_details" "text", "p_amount_minor" bigint, "p_metadata" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."normalize_booking_id"("raw_id" "text") RETURNS "text"
    LANGUAGE "plpgsql"
    AS $_$
declare
  cleaned text;
begin
  if raw_id is null or btrim(raw_id) = '' then
    return concat('A', nextval('public.booking_code_seq'));
  end if;

  cleaned := upper(raw_id);
  if cleaned ~ '^A[0-9]+$' then
    return cleaned;
  end if;

  cleaned := regexp_replace(cleaned, '\\D', '', 'g');
  if cleaned <> '' then
    return concat('A', cleaned);
  end if;

  return concat('A', nextval('public.booking_code_seq'));
end;
$_$;


ALTER FUNCTION "public"."normalize_booking_id"("raw_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reservations_booking_id_normalizer"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  if tg_op = 'INSERT' then
    new.booking_id := public.normalize_booking_id(new.booking_id);
  elsif tg_op = 'UPDATE' and (new.booking_id is distinct from old.booking_id) then
    new.booking_id := public.normalize_booking_id(new.booking_id);
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."reservations_booking_id_normalizer"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."role_level"("role_id" "uuid") RETURNS integer
    LANGUAGE "sql" STABLE
    AS $$
  SELECT hierarchy_level FROM public.roles WHERE id = role_id;
$$;


ALTER FUNCTION "public"."role_level"("role_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_admin_activity_log_actor"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  resolved_actor uuid;
  resolved_role text;
  resolved_name text;
begin
  resolved_actor := coalesce(new.actor_user_id, auth.uid());
  new.actor_user_id := resolved_actor;

  if new.actor_role is null then
    if resolved_actor is not null then
      resolved_role := coalesce(public.get_user_role(resolved_actor), 'Unknown Role');
    else
      resolved_role := 'Unknown Role';
    end if;
    new.actor_role := resolved_role;
  end if;

  if new.actor_name is null and resolved_actor is not null then
    select coalesce(p.name, au.email)
    into resolved_name
    from public.profiles p
    left join auth.users au on au.id = p.id
    where p.id = resolved_actor;

    new.actor_name := coalesce(resolved_name, 'Unknown User');
  elsif new.actor_name is null then
    new.actor_name := 'Unknown User';
  end if;

  if new.details is null then
    new.details := initcap(replace(new.action, '_', ' '));
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."set_admin_activity_log_actor"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_first_user_as_owner"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  user_count INTEGER;
  owner_role_id UUID;
BEGIN
  -- Count the total number of users
  SELECT count(*) INTO user_count FROM auth.users;
  
  -- If this is the first user, update their role to 'Hotel Owner'
  IF user_count = 1 THEN
    SELECT id INTO owner_role_id FROM public.roles WHERE name = 'Hotel Owner';
    IF owner_role_id IS NOT NULL THEN
      UPDATE public.profiles
      SET role_id = owner_role_id
      WHERE id = NEW.id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_first_user_as_owner"() OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."event_banners" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "image_url" "text" NOT NULL,
    "is_active" boolean DEFAULT false NOT NULL,
    "starts_at" timestamp with time zone,
    "ends_at" timestamp with time zone,
    "updated_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "event_banners_title_check" CHECK (("char_length"("title") <= 200))
);


ALTER TABLE "public"."event_banners" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."toggle_event_banner"("target_event_id" "uuid", "new_status" boolean) RETURNS SETOF "public"."event_banners"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
DECLARE
    current_user_id UUID;
    has_permission BOOLEAN;
BEGIN
    current_user_id := auth.uid();
    
    -- Check for authentication
    IF current_user_id IS NULL THEN
        RAISE EXCEPTION 'Access denied: Unauthenticated user';
    END IF;

    -- Verify permissions
    -- Note: explicit search_path ensures we find user_has_permission correctly
    has_permission := public.user_has_permission(current_user_id, 'update:setting');

    IF NOT has_permission THEN
        RAISE EXCEPTION 'Access denied: User % lacks update:setting permission', current_user_id;
    END IF;

    -- If we are enabling a banner, we must first disable all others
    IF new_status = true THEN
        UPDATE public.event_banners
        SET is_active = false
        WHERE id != target_event_id;
    END IF;

    -- Update the target banner
    RETURN QUERY
    UPDATE public.event_banners
    SET 
        is_active = new_status,
        updated_at = now(),
        updated_by = current_user_id
    WHERE id = target_event_id
    RETURNING *;
END;
$$;


ALTER FUNCTION "public"."toggle_event_banner"("target_event_id" "uuid", "new_status" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."touch_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."touch_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."upsert_room_type_with_amenities"("p_id" "uuid", "p_name" "text", "p_description" "text", "p_max_occupancy" integer, "p_bed_types" "text"[], "p_price" numeric, "p_photos" "text"[], "p_main_photo_url" "text", "p_amenity_ids" "uuid"[]) RETURNS json
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_room_type_id uuid;
    result_room_type record;
BEGIN
    IF p_id IS NULL THEN
        INSERT INTO public.room_types (name, description, max_occupancy, bed_types, price, photos, main_photo_url)
        VALUES (p_name, p_description, p_max_occupancy, p_bed_types, p_price, p_photos, p_main_photo_url)
        RETURNING id INTO v_room_type_id;
    ELSE
        UPDATE public.room_types
        SET
            name = p_name,
            description = p_description,
            max_occupancy = p_max_occupancy,
            bed_types = p_bed_types,
            price = p_price,
            photos = p_photos,
            main_photo_url = p_main_photo_url
        WHERE id = p_id
        RETURNING id INTO v_room_type_id;
    END IF;

    DELETE FROM public.room_type_amenities WHERE room_type_id = v_room_type_id;

    IF array_length(p_amenity_ids, 1) > 0 THEN
        INSERT INTO public.room_type_amenities (room_type_id, amenity_id)
        SELECT v_room_type_id, unnest(p_amenity_ids);
    END IF;

    SELECT rt.*, COALESCE(json_agg(rta.amenity_id) FILTER (WHERE rta.amenity_id IS NOT NULL), '[]') as amenities
    INTO result_room_type
    FROM public.room_types rt
    LEFT JOIN public.room_type_amenities rta ON rt.id = rta.room_type_id
    WHERE rt.id = v_room_type_id
    GROUP BY rt.id;

    RETURN row_to_json(result_room_type);
END;
$$;


ALTER FUNCTION "public"."upsert_room_type_with_amenities"("p_id" "uuid", "p_name" "text", "p_description" "text", "p_max_occupancy" integer, "p_bed_types" "text"[], "p_price" numeric, "p_photos" "text"[], "p_main_photo_url" "text", "p_amenity_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."upsert_room_type_with_amenities"("p_id" "uuid", "p_name" "text", "p_description" "text", "p_max_occupancy" integer, "p_bed_types" "text"[], "p_price" numeric, "p_photos" "text"[], "p_main_photo_url" "text", "p_amenity_ids" "uuid"[], "p_is_visible" boolean DEFAULT true) RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_room_type_id uuid;
    result_room_type record;
BEGIN
    IF p_id IS NULL THEN
        INSERT INTO public.room_types (
            name,
            description,
            max_occupancy,
            bed_types,
            price,
            photos,
            main_photo_url,
            is_visible
        )
        VALUES (
            p_name,
            p_description,
            p_max_occupancy,
            p_bed_types,
            p_price,
            p_photos,
            p_main_photo_url,
            COALESCE(p_is_visible, TRUE)
        )
        RETURNING id INTO v_room_type_id;
    ELSE
        UPDATE public.room_types
        SET
            name = p_name,
            description = p_description,
            max_occupancy = p_max_occupancy,
            bed_types = p_bed_types,
            price = p_price,
            photos = p_photos,
            main_photo_url = p_main_photo_url,
            is_visible = COALESCE(p_is_visible, TRUE)
        WHERE id = p_id
        RETURNING id INTO v_room_type_id;
    END IF;

    DELETE FROM public.room_type_amenities WHERE room_type_id = v_room_type_id;

    IF array_length(p_amenity_ids, 1) > 0 THEN
        INSERT INTO public.room_type_amenities (room_type_id, amenity_id)
        SELECT v_room_type_id, unnest(p_amenity_ids);
    END IF;

    SELECT
        rt.*,
        COALESCE(json_agg(rta.amenity_id) FILTER (WHERE rta.amenity_id IS NOT NULL), '[]') AS amenities
    INTO result_room_type
    FROM public.room_types rt
    LEFT JOIN public.room_type_amenities rta ON rt.id = rta.room_type_id
    WHERE rt.id = v_room_type_id
    GROUP BY rt.id;

    RETURN row_to_json(result_room_type);
END;
$$;


ALTER FUNCTION "public"."upsert_room_type_with_amenities"("p_id" "uuid", "p_name" "text", "p_description" "text", "p_max_occupancy" integer, "p_bed_types" "text"[], "p_price" numeric, "p_photos" "text"[], "p_main_photo_url" "text", "p_amenity_ids" "uuid"[], "p_is_visible" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_can_manage_role"("actor_user_id" "uuid", "target_role_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  actor_level integer;
  target_level integer;
BEGIN
  IF actor_user_id IS NULL OR target_role_id IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT public.user_role_level(actor_user_id) INTO actor_level;
  SELECT public.role_level(target_role_id) INTO target_level;

  IF actor_level IS NULL OR target_level IS NULL THEN
    RETURN FALSE;
  END IF;

  RETURN actor_level > target_level;
END;
$$;


ALTER FUNCTION "public"."user_can_manage_role"("actor_user_id" "uuid", "target_role_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_can_manage_role_level"("actor_user_id" "uuid", "target_level" integer) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  actor_level integer;
BEGIN
  IF actor_user_id IS NULL OR target_level IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT public.user_role_level(actor_user_id) INTO actor_level;

  IF actor_level IS NULL THEN
    RETURN FALSE;
  END IF;

  RETURN actor_level > target_level;
END;
$$;


ALTER FUNCTION "public"."user_can_manage_role_level"("actor_user_id" "uuid", "target_level" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_can_manage_user"("actor_user_id" "uuid", "target_user_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  target_role uuid;
BEGIN
  IF actor_user_id IS NULL OR target_user_id IS NULL OR actor_user_id = target_user_id THEN
    RETURN FALSE;
  END IF;

  SELECT role_id INTO target_role FROM public.profiles WHERE id = target_user_id;
  IF target_role IS NULL THEN
    RETURN FALSE;
  END IF;

  RETURN public.user_can_manage_role(actor_user_id, target_role);
END;
$$;


ALTER FUNCTION "public"."user_can_manage_user"("actor_user_id" "uuid", "target_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_has_permission"("user_id" "uuid", "permission_text" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  role_permissions TEXT[];
BEGIN
  IF permission_text IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT r.permissions
    INTO role_permissions
  FROM public.profiles p
  JOIN public.roles r ON p.role_id = r.id
  WHERE p.id = user_id;

  RETURN permission_text = ANY (COALESCE(role_permissions, ARRAY[]::text[]));
END;
$$;


ALTER FUNCTION "public"."user_has_permission"("user_id" "uuid", "permission_text" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_role_level"("user_id" "uuid") RETURNS integer
    LANGUAGE "sql" STABLE
    AS $$
  SELECT public.role_level(p.role_id) FROM public.profiles p WHERE p.id = user_id;
$$;


ALTER FUNCTION "public"."user_role_level"("user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_booking_request"("p_check_in" "date", "p_check_out" "date", "p_room_id" "uuid", "p_adults" integer, "p_children" integer DEFAULT 0) RETURNS json
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_nights INTEGER;
    v_checkin_day INTEGER;
    v_result JSON;
    v_room_type_id UUID;
BEGIN
    -- Calculate nights and check-in weekday (0 = Sunday)
    v_nights := p_check_out - p_check_in;
    v_checkin_day := EXTRACT(DOW FROM p_check_in);

    -- Resolve the room type so restrictions scoped to room types work correctly
    SELECT room_type_id
    INTO v_room_type_id
    FROM rooms
    WHERE id = p_room_id
    LIMIT 1;

    -- Check minimum stay restrictions
    IF EXISTS (
        SELECT 1
        FROM booking_restrictions
        WHERE restriction_type = 'min_stay'
          AND (start_date IS NULL OR start_date <= p_check_in)
          AND (end_date IS NULL OR end_date >= p_check_out)
          AND (
            room_type_id IS NULL
            OR (v_room_type_id IS NOT NULL AND room_type_id = v_room_type_id)
          )
          AND (value->>'minNights')::INTEGER > v_nights
    ) THEN
        v_result := json_build_object('isValid', false, 'message', 'Minimum stay not met');
        RETURN v_result;
    END IF;

    -- Check check-in day restrictions using jsonb array enumeration
    IF EXISTS (
        SELECT 1
        FROM booking_restrictions
        WHERE restriction_type = 'checkin_days'
          AND (start_date IS NULL OR start_date <= p_check_in)
          AND (end_date IS NULL OR end_date >= p_check_out)
          AND (
            room_type_id IS NULL
            OR (v_room_type_id IS NOT NULL AND room_type_id = v_room_type_id)
          )
          AND value->'allowedDays' IS NOT NULL
          AND jsonb_typeof(value->'allowedDays') = 'array'
          AND NOT EXISTS (
            SELECT 1
            FROM jsonb_array_elements_text(value->'allowedDays') AS allowed(day_text)
            WHERE (allowed.day_text)::INTEGER = v_checkin_day
          )
    ) THEN
        v_result := json_build_object('isValid', false, 'message', 'Check-in not allowed on this day');
        RETURN v_result;
    END IF;

    -- Return valid result
    v_result := json_build_object('isValid', true);
    RETURN v_result;
END;
$$;


ALTER FUNCTION "public"."validate_booking_request"("p_check_in" "date", "p_check_out" "date", "p_room_id" "uuid", "p_adults" integer, "p_children" integer) OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."amenities" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "icon" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."amenities" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."booking_code_seq"
    START WITH 6551
    INCREMENT BY 1
    MINVALUE 1111
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."booking_code_seq" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."booking_restrictions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text",
    "restriction_type" "text" NOT NULL,
    "value" "jsonb" NOT NULL,
    "start_date" "date",
    "end_date" "date",
    "room_type_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "booking_restrictions_season_closed_chk" CHECK ((("restriction_type" <> 'season'::"text") OR ("value" ? 'closed'::"text")))
);


ALTER TABLE "public"."booking_restrictions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."folio_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "reservation_id" "uuid",
    "description" "text" NOT NULL,
    "amount" numeric(10,2) NOT NULL,
    "timestamp" timestamp with time zone DEFAULT "now"(),
    "payment_method" "text",
    "external_source" "text" DEFAULT 'internal'::"text" NOT NULL,
    "external_reference" "text",
    "external_metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL
);


ALTER TABLE "public"."folio_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rooms" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "room_number" "text" NOT NULL,
    "room_type_id" "uuid",
    "status" "text" NOT NULL,
    "photos" "text"[],
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."rooms" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."bookings_summary_view" AS
 WITH "filtered_reservations" AS (
         SELECT "r_1"."id",
            "r_1"."booking_id",
            "r_1"."guest_id",
            "r_1"."room_id",
            "r_1"."rate_plan_id",
            "r_1"."check_in_date",
            "r_1"."check_out_date",
            "r_1"."number_of_guests",
            "r_1"."status",
            "r_1"."notes",
            "r_1"."total_amount",
            "r_1"."booking_date",
            "r_1"."source",
            "r_1"."payment_method",
            "r_1"."adult_count",
            "r_1"."child_count",
            "r_1"."tax_enabled_snapshot",
            "r_1"."tax_rate_snapshot",
            "r_1"."external_source",
            "r_1"."external_id",
            "r_1"."external_metadata",
            "rooms"."room_number" AS "room_number_actual"
           FROM ("public"."reservations" "r_1"
             LEFT JOIN "public"."rooms" ON (("r_1"."room_id" = "rooms"."id")))
          WHERE (("r_1"."external_metadata" IS NULL) OR (("r_1"."external_metadata" ->> 'removedDuringEdit'::"text") IS NULL) OR (("r_1"."external_metadata" ->> 'removedDuringEdit'::"text") <> 'true'::"text"))
        )
 SELECT "r"."booking_id",
    "min"("r"."booking_date") AS "booking_date",
    "max"("g"."first_name") AS "guest_first_name",
    "max"("g"."last_name") AS "guest_last_name",
    COALESCE("max"((("g"."first_name" || ' '::"text") || "g"."last_name")), 'N/A'::"text") AS "guest_name",
    "max"("g"."email") AS "guest_email",
    "max"("g"."phone") AS "guest_phone",
    "sum"("r"."total_amount") AS "total_amount",
    "count"("r"."id") AS "room_count",
    "min"("r"."check_in_date") AS "check_in_date",
    "max"("r"."check_out_date") AS "check_out_date",
    "sum"("r"."number_of_guests") AS "number_of_guests",
    "sum"(COALESCE("r"."adult_count", 0)) AS "adult_count",
    "sum"(COALESCE("r"."child_count", 0)) AS "child_count",
    ("max"(("r"."guest_id")::"text"))::"uuid" AS "guest_id",
        CASE "max"(
            CASE "r"."status"
                WHEN 'Checked-out'::"text" THEN 5
                WHEN 'Checked-in'::"text" THEN 4
                WHEN 'Confirmed'::"text" THEN 3
                WHEN 'Standby'::"text" THEN 2
                WHEN 'Tentative'::"text" THEN 1
                WHEN 'Cancelled'::"text" THEN 0
                WHEN 'No-show'::"text" THEN '-1'::integer
                ELSE '-2'::integer
            END)
            WHEN 5 THEN 'Checked-out'::"text"
            WHEN 4 THEN 'Checked-in'::"text"
            WHEN 3 THEN 'Confirmed'::"text"
            WHEN 2 THEN 'Standby'::"text"
            WHEN 1 THEN 'Tentative'::"text"
            WHEN 0 THEN 'Cancelled'::"text"
            WHEN '-1'::integer THEN 'No-show'::"text"
            ELSE 'Tentative'::"text"
        END AS "status",
    "jsonb_agg"("jsonb_build_object"('id', "r"."id", 'bookingId', "r"."booking_id", 'guestId', "r"."guest_id", 'roomId', "r"."room_id", 'ratePlanId', "r"."rate_plan_id", 'checkInDate', "r"."check_in_date", 'checkOutDate', "r"."check_out_date", 'numberOfGuests', "r"."number_of_guests", 'status', "r"."status", 'notes', "r"."notes", 'totalAmount', "r"."total_amount", 'bookingDate', "r"."booking_date", 'source', "r"."source", 'paymentMethod', "r"."payment_method", 'adultCount', "r"."adult_count", 'childCount', "r"."child_count", 'taxEnabledSnapshot', "r"."tax_enabled_snapshot", 'taxRateSnapshot', "r"."tax_rate_snapshot", 'externalSource', "r"."external_source", 'externalId', "r"."external_id", 'externalMetadata', "r"."external_metadata", 'roomNumber', "r"."room_number_actual", 'folio', COALESCE(( SELECT "jsonb_agg"("jsonb_build_object"('id', "fi"."id", 'description', "fi"."description", 'amount', "fi"."amount", 'timestamp', "fi"."timestamp", 'paymentMethod', "fi"."payment_method", 'externalSource', "fi"."external_source", 'externalReference', "fi"."external_reference", 'externalMetadata', "fi"."external_metadata")) AS "jsonb_agg"
           FROM "public"."folio_items" "fi"
          WHERE ("fi"."reservation_id" = "r"."id")), '[]'::"jsonb"))) AS "reservation_rows"
   FROM ("filtered_reservations" "r"
     LEFT JOIN "public"."guests" "g" ON (("r"."guest_id" = "g"."id")))
  GROUP BY "r"."booking_id";


ALTER VIEW "public"."bookings_summary_view" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "description" "text",
    "parent_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."donations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "donor_name" "text" NOT NULL,
    "email" "text" NOT NULL,
    "phone" "text" NOT NULL,
    "amount_in_minor" bigint NOT NULL,
    "currency" "text" DEFAULT 'INR'::"text" NOT NULL,
    "frequency" "text" DEFAULT 'one_time'::"text" NOT NULL,
    "message" "text",
    "consent" boolean DEFAULT false NOT NULL,
    "payment_provider" "text" DEFAULT 'stripe'::"text" NOT NULL,
    "payment_status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "stripe_session_id" "text",
    "upi_reference" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "razorpay_order_id" "text",
    "razorpay_payment_id" "text",
    "razorpay_signature" "text",
    CONSTRAINT "donations_amount_in_minor_check" CHECK (("amount_in_minor" > 0)),
    CONSTRAINT "donations_frequency_check" CHECK (("frequency" = ANY (ARRAY['one_time'::"text", 'monthly'::"text"]))),
    CONSTRAINT "donations_payment_status_check" CHECK (("payment_status" = ANY (ARRAY['pending'::"text", 'paid'::"text", 'failed'::"text", 'refunded'::"text"])))
);


ALTER TABLE "public"."donations" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."donation_stats" AS
 SELECT (COALESCE("sum"("amount_in_minor"), (0)::numeric))::bigint AS "total_amount_in_minor",
    "count"(*) AS "total_donations",
    "count"(*) FILTER (WHERE ("frequency" = 'monthly'::"text")) AS "monthly_donations",
    "max"("created_at") AS "last_donation_at"
   FROM "public"."donations";


ALTER VIEW "public"."donation_stats" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."external_room_links" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "source" "text" NOT NULL,
    "external_label" "text" NOT NULL,
    "room_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."external_room_links" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."feedback" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "feedback_type" "public"."feedback_type" NOT NULL,
    "message" "text" NOT NULL,
    "name" "text",
    "is_anonymous" boolean DEFAULT false NOT NULL,
    "email" "text",
    "room_or_facility" "text",
    "rating" integer,
    "status" "public"."feedback_status" DEFAULT 'new'::"public"."feedback_status" NOT NULL,
    "internal_note" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "feedback_message_check" CHECK (("char_length"("message") <= 500)),
    CONSTRAINT "feedback_rating_check" CHECK ((("rating" >= 1) AND ("rating" <= 5)))
);


ALTER TABLE "public"."feedback" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."housekeeping_assignments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "room_id" "uuid",
    "assigned_to" "uuid",
    "date" "date" NOT NULL,
    "status" "text" NOT NULL
);


ALTER TABLE "public"."housekeeping_assignments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."import_job_entries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "job_id" "uuid" NOT NULL,
    "row_number" integer NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "message" "text",
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "skip_reason_code" "text",
    CONSTRAINT "import_job_entries_row_number_check" CHECK (("row_number" >= 1)),
    CONSTRAINT "import_job_entries_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'skipped'::"text", 'imported'::"text", 'error'::"text"])))
);


ALTER TABLE "public"."import_job_entries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."import_jobs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "source" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "file_name" "text",
    "file_hash" "text",
    "total_rows" integer DEFAULT 0 NOT NULL,
    "processed_rows" integer DEFAULT 0 NOT NULL,
    "error_rows" integer DEFAULT 0 NOT NULL,
    "summary" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "completed_at" timestamp with time zone,
    "last_error" "text",
    CONSTRAINT "import_jobs_error_rows_check" CHECK (("error_rows" >= 0)),
    CONSTRAINT "import_jobs_processed_rows_check" CHECK (("processed_rows" >= 0)),
    CONSTRAINT "import_jobs_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'validating'::"text", 'requires_mapping'::"text", 'running'::"text", 'completed'::"text", 'failed'::"text"]))),
    CONSTRAINT "import_jobs_total_rows_check" CHECK (("total_rows" >= 0))
);


ALTER TABLE "public"."import_jobs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."manual_receipts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "slip_no" integer NOT NULL,
    "first_name" "text" NOT NULL,
    "last_name" "text" NOT NULL,
    "phone" "text" NOT NULL,
    "email" "text",
    "address" "text",
    "amount" numeric(10,2) NOT NULL,
    "payment_method" "text" NOT NULL,
    "transaction_id" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "note" "text",
    "status" "text" DEFAULT 'Accepted'::"text" NOT NULL,
    "by_hand" "text",
    "creator" "text",
    "img_link" "text",
    CONSTRAINT "manual_receipts_amount_check" CHECK (("amount" > (0)::numeric))
);


ALTER TABLE "public"."manual_receipts" OWNER TO "postgres";


ALTER TABLE "public"."manual_receipts" ALTER COLUMN "slip_no" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."manual_receipts_slip_no_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."post_categories" (
    "post_id" "uuid" NOT NULL,
    "category_id" "uuid" NOT NULL
);


ALTER TABLE "public"."post_categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."posts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "content" "text",
    "excerpt" "text",
    "featured_image" "text",
    "status" "text" DEFAULT 'draft'::"text",
    "published_at" timestamp with time zone,
    "author_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."posts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pricing_occupancy_rules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "room_type_id" "uuid" NOT NULL,
    "guest_count" integer NOT NULL,
    "guest_type" "public"."pricing_guest_type" NOT NULL,
    "adjustment_type" "public"."pricing_adjustment_type" NOT NULL,
    "adjustment_value" numeric(10,2) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "pricing_occupancy_rules_guest_count_check" CHECK (("guest_count" > 0))
);


ALTER TABLE "public"."pricing_occupancy_rules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pricing_rates_grid" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "room_type_id" "uuid" NOT NULL,
    "rate_plan_id" "uuid",
    "days" integer NOT NULL,
    "total_cost" numeric(10,2) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "pricing_rates_grid_days_check" CHECK (("days" > 0)),
    CONSTRAINT "pricing_rates_grid_total_cost_check" CHECK (("total_cost" >= (0)::numeric))
);


ALTER TABLE "public"."pricing_rates_grid" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pricing_seasons" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "start_date" "date" NOT NULL,
    "end_date" "date" NOT NULL,
    "adjustment_type" "public"."pricing_adjustment_type" NOT NULL,
    "adjustment_value" numeric(10,2) NOT NULL,
    "room_type_id" "uuid",
    "rate_plan_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "valid_date_range" CHECK (("end_date" >= "start_date"))
);


ALTER TABLE "public"."pricing_seasons" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "name" "text",
    "avatar_url" "text",
    "role_id" "uuid"
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."properties" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "address" "text",
    "phone" "text",
    "email" "text",
    "logo_url" "text",
    "photos" "text"[],
    "google_maps_url" "text",
    "timezone" "text",
    "currency" "text",
    "allow_same_day_turnover" boolean DEFAULT true NOT NULL,
    "show_partial_days" boolean DEFAULT true NOT NULL,
    "default_units_view" "text" DEFAULT 'remaining'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tax_enabled" boolean DEFAULT false NOT NULL,
    "tax_percentage" numeric(5,4) DEFAULT 0 NOT NULL,
    "trust_registration_no" "text",
    "trust_date" "text",
    "pan_no" "text",
    "certificate_no" "text",
    CONSTRAINT "properties_default_units_view_check" CHECK (("default_units_view" = ANY (ARRAY['remaining'::"text", 'booked'::"text"])))
);


ALTER TABLE "public"."properties" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."property_closures" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "property_id" "uuid" NOT NULL,
    "room_type_id" "uuid",
    "start_date" "date" NOT NULL,
    "end_date" "date" NOT NULL,
    "reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "property_closures_valid_range" CHECK (("start_date" <= "end_date"))
);


ALTER TABLE "public"."property_closures" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rate_plans" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "rules" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "tax_id" "uuid",
    "min_los" integer DEFAULT 1 NOT NULL,
    "min_hours_advance" integer,
    "board" "text",
    "free_cancellation" boolean DEFAULT false NOT NULL,
    "is_derived" boolean DEFAULT false NOT NULL,
    "derived_parent_id" "uuid",
    "derived_mode" "text",
    "derived_type" "text",
    "derived_value" numeric,
    "inherit_restrictions" boolean DEFAULT false NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "price" numeric(10,2) DEFAULT 0,
    CONSTRAINT "rate_plans_derived_mode_check" CHECK (("derived_mode" = ANY (ARRAY['discount'::"text", 'charge'::"text"]))),
    CONSTRAINT "rate_plans_derived_type_check" CHECK (("derived_type" = ANY (ARRAY['percent'::"text", 'absolute'::"text"])))
);


ALTER TABLE "public"."rate_plans" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."reservation_activity_logs_vw" WITH ("security_invoker"='true') AS
 SELECT "id",
    "entity_id" AS "reservation_id",
    "actor_user_id",
    "actor_role",
    "actor_name",
    "action",
    "amount_minor",
    "details" AS "notes",
    "metadata",
    "created_at"
   FROM "public"."admin_activity_logs"
  WHERE (("section" = 'reservations'::"text") AND (("entity_type" IS NULL) OR ("entity_type" = 'reservation'::"text")));


ALTER VIEW "public"."reservation_activity_logs_vw" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."reservations_booking_id_backup_20251216" (
    "id" "uuid",
    "booking_id" "text",
    "backed_up_at" timestamp with time zone
);


ALTER TABLE "public"."reservations_booking_id_backup_20251216" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."roles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "permissions" "text"[],
    "hierarchy_level" integer DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."roles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."room_categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."room_categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."room_type_amenities" (
    "room_type_id" "uuid" NOT NULL,
    "amenity_id" "uuid" NOT NULL
);


ALTER TABLE "public"."room_type_amenities" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."room_types" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "max_occupancy" integer NOT NULL,
    "bed_types" "text"[],
    "photos" "text"[],
    "main_photo_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "price" numeric(10,2) DEFAULT 0,
    "min_occupancy" integer DEFAULT 1,
    "max_children" integer DEFAULT 0,
    "category_id" "uuid",
    "is_visible" boolean DEFAULT true NOT NULL
);


ALTER TABLE "public"."room_types" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."seasonal_prices" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "room_type_id" "uuid" NOT NULL,
    "name" "text",
    "price" numeric(10,2) NOT NULL,
    "start_date" "date" NOT NULL,
    "end_date" "date" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "seasonal_prices_date_order" CHECK (("start_date" <= "end_date"))
);


ALTER TABLE "public"."seasonal_prices" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sticky_notes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "title" "text" NOT NULL,
    "description" "text",
    "color" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."sticky_notes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tariffs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "room_type_id" "uuid" NOT NULL,
    "rate_plan_id" "uuid" NOT NULL,
    "nights_from" integer NOT NULL,
    "nights_to" integer NOT NULL,
    "price_per_night" numeric NOT NULL,
    "currency" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "nights" "int4range" GENERATED ALWAYS AS ("int4range"("nights_from", ("nights_to" + 1), '[]'::"text")) STORED,
    CONSTRAINT "tariffs_check" CHECK (("nights_to" >= "nights_from")),
    CONSTRAINT "tariffs_nights_from_check" CHECK (("nights_from" >= 1)),
    CONSTRAINT "tariffs_price_per_night_check" CHECK (("price_per_night" >= (0)::numeric))
);


ALTER TABLE "public"."tariffs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."testimonials" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "reviewer_name" "text" NOT NULL,
    "reviewer_title" "text",
    "content" "text" NOT NULL,
    "image_url" "text" NOT NULL,
    "is_published" boolean DEFAULT true NOT NULL,
    "updated_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "testimonials_content_check" CHECK ((("char_length"("content") >= 1) AND ("char_length"("content") <= 2000))),
    CONSTRAINT "testimonials_reviewer_name_check" CHECK ((("char_length"("reviewer_name") >= 1) AND ("char_length"("reviewer_name") <= 150)))
);


ALTER TABLE "public"."testimonials" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."vikbooking_room_number_links" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "source" "text" DEFAULT 'vikbooking'::"text" NOT NULL,
    "external_number" "text" NOT NULL,
    "external_number_normalized" "text" NOT NULL,
    "room_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."vikbooking_room_number_links" OWNER TO "postgres";


ALTER TABLE ONLY "public"."admin_activity_logs"
    ADD CONSTRAINT "admin_activity_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."amenities"
    ADD CONSTRAINT "amenities_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."booking_restrictions"
    ADD CONSTRAINT "booking_restrictions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."donations"
    ADD CONSTRAINT "donations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."donations"
    ADD CONSTRAINT "donations_stripe_session_id_key" UNIQUE ("stripe_session_id");



ALTER TABLE ONLY "public"."event_banners"
    ADD CONSTRAINT "event_banners_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."external_room_links"
    ADD CONSTRAINT "external_room_links_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."external_room_links"
    ADD CONSTRAINT "external_room_links_source_external_label_key" UNIQUE ("source", "external_label");



ALTER TABLE ONLY "public"."feedback"
    ADD CONSTRAINT "feedback_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."folio_items"
    ADD CONSTRAINT "folio_items_external_reference_unique" UNIQUE ("reservation_id", "external_source", "external_reference");



ALTER TABLE ONLY "public"."folio_items"
    ADD CONSTRAINT "folio_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."guests"
    ADD CONSTRAINT "guests_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."guests"
    ADD CONSTRAINT "guests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."housekeeping_assignments"
    ADD CONSTRAINT "housekeeping_assignments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."housekeeping_assignments"
    ADD CONSTRAINT "housekeeping_assignments_room_id_date_key" UNIQUE ("room_id", "date");



ALTER TABLE ONLY "public"."import_job_entries"
    ADD CONSTRAINT "import_job_entries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."import_jobs"
    ADD CONSTRAINT "import_jobs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."manual_receipts"
    ADD CONSTRAINT "manual_receipts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."post_categories"
    ADD CONSTRAINT "post_categories_pkey" PRIMARY KEY ("post_id", "category_id");



ALTER TABLE ONLY "public"."posts"
    ADD CONSTRAINT "posts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."posts"
    ADD CONSTRAINT "posts_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."pricing_occupancy_rules"
    ADD CONSTRAINT "pricing_occupancy_rules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pricing_occupancy_rules"
    ADD CONSTRAINT "pricing_occupancy_rules_room_type_id_guest_count_guest_type_key" UNIQUE ("room_type_id", "guest_count", "guest_type");



ALTER TABLE ONLY "public"."pricing_rates_grid"
    ADD CONSTRAINT "pricing_rates_grid_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pricing_rates_grid"
    ADD CONSTRAINT "pricing_rates_grid_room_type_id_rate_plan_id_days_key" UNIQUE ("room_type_id", "rate_plan_id", "days");



ALTER TABLE ONLY "public"."pricing_seasons"
    ADD CONSTRAINT "pricing_seasons_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."properties"
    ADD CONSTRAINT "properties_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."property_closures"
    ADD CONSTRAINT "property_closures_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rate_plans"
    ADD CONSTRAINT "rate_plans_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reservations"
    ADD CONSTRAINT "reservations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."roles"
    ADD CONSTRAINT "roles_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."roles"
    ADD CONSTRAINT "roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."room_categories"
    ADD CONSTRAINT "room_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."room_type_amenities"
    ADD CONSTRAINT "room_type_amenities_pkey" PRIMARY KEY ("room_type_id", "amenity_id");



ALTER TABLE ONLY "public"."room_types"
    ADD CONSTRAINT "room_types_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rooms"
    ADD CONSTRAINT "rooms_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rooms"
    ADD CONSTRAINT "rooms_room_type_id_room_number_key" UNIQUE ("room_type_id", "room_number");



COMMENT ON CONSTRAINT "rooms_room_type_id_room_number_key" ON "public"."rooms" IS 'Ensure room numbers are unique within a room type, but reusable across types.';



ALTER TABLE ONLY "public"."seasonal_prices"
    ADD CONSTRAINT "seasonal_prices_no_overlap" EXCLUDE USING "gist" ("room_type_id" WITH =, "daterange"("start_date", "end_date", '[]'::"text") WITH &&);



ALTER TABLE ONLY "public"."seasonal_prices"
    ADD CONSTRAINT "seasonal_prices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sticky_notes"
    ADD CONSTRAINT "sticky_notes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tariffs"
    ADD CONSTRAINT "tariffs_no_overlap" EXCLUDE USING "gist" ("room_type_id" WITH =, "rate_plan_id" WITH =, "nights" WITH &&);



ALTER TABLE ONLY "public"."tariffs"
    ADD CONSTRAINT "tariffs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tariffs"
    ADD CONSTRAINT "tariffs_room_type_id_rate_plan_id_nights_from_nights_to_key" UNIQUE ("room_type_id", "rate_plan_id", "nights_from", "nights_to");



ALTER TABLE ONLY "public"."testimonials"
    ADD CONSTRAINT "testimonials_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."vikbooking_room_number_links"
    ADD CONSTRAINT "vikbooking_room_number_links_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."vikbooking_room_number_links"
    ADD CONSTRAINT "vikbooking_room_number_links_unique" UNIQUE ("source", "external_number_normalized");



CREATE INDEX "admin_activity_logs_actor_role_created_idx" ON "public"."admin_activity_logs" USING "btree" ("actor_role", "created_at" DESC);



CREATE INDEX "admin_activity_logs_entity_created_idx" ON "public"."admin_activity_logs" USING "btree" ("entity_type", "entity_id", "created_at" DESC);



CREATE INDEX "admin_activity_logs_metadata_idx" ON "public"."admin_activity_logs" USING "gin" ("metadata" "jsonb_path_ops");



CREATE INDEX "admin_activity_logs_section_created_idx" ON "public"."admin_activity_logs" USING "btree" ("section", "created_at" DESC);



CREATE INDEX "donations_created_at_idx" ON "public"."donations" USING "btree" ("created_at" DESC);



CREATE INDEX "donations_payment_status_idx" ON "public"."donations" USING "btree" ("payment_status");



CREATE UNIQUE INDEX "donations_razorpay_order_id_idx" ON "public"."donations" USING "btree" ("razorpay_order_id") WHERE ("razorpay_order_id" IS NOT NULL);



CREATE INDEX "donations_razorpay_payment_id_idx" ON "public"."donations" USING "btree" ("razorpay_payment_id") WHERE ("razorpay_payment_id" IS NOT NULL);



CREATE INDEX "event_banners_active_idx" ON "public"."event_banners" USING "btree" ("is_active");



CREATE INDEX "event_banners_end_idx" ON "public"."event_banners" USING "btree" ("ends_at");



CREATE INDEX "event_banners_start_idx" ON "public"."event_banners" USING "btree" ("starts_at");



CREATE INDEX "feedback_created_at_idx" ON "public"."feedback" USING "btree" ("created_at" DESC);



CREATE INDEX "feedback_status_idx" ON "public"."feedback" USING "btree" ("status");



CREATE INDEX "feedback_type_idx" ON "public"."feedback" USING "btree" ("feedback_type");



CREATE INDEX "idx_booking_restrictions_dates" ON "public"."booking_restrictions" USING "btree" ("start_date", "end_date");



CREATE INDEX "idx_booking_restrictions_room_type" ON "public"."booking_restrictions" USING "btree" ("room_type_id");



CREATE INDEX "idx_booking_restrictions_type" ON "public"."booking_restrictions" USING "btree" ("restriction_type");



CREATE INDEX "idx_property_closures_dates" ON "public"."property_closures" USING "btree" ("start_date", "end_date");



CREATE INDEX "idx_property_closures_property" ON "public"."property_closures" USING "btree" ("property_id");



CREATE INDEX "idx_property_closures_room_type" ON "public"."property_closures" USING "btree" ("room_type_id");



CREATE INDEX "idx_seasonal_prices_lookup" ON "public"."seasonal_prices" USING "btree" ("room_type_id", "start_date", "end_date");



CREATE INDEX "import_job_entries_job_idx" ON "public"."import_job_entries" USING "btree" ("job_id", "row_number");



CREATE INDEX "import_job_entries_status_idx" ON "public"."import_job_entries" USING "btree" ("status");



CREATE INDEX "import_jobs_source_idx" ON "public"."import_jobs" USING "btree" ("source", "created_at" DESC);



CREATE INDEX "manual_receipts_created_at_idx" ON "public"."manual_receipts" USING "btree" ("created_at" DESC);



CREATE INDEX "manual_receipts_slip_no_idx" ON "public"."manual_receipts" USING "btree" ("slip_no");



CREATE INDEX "reservations_booking_id_idx" ON "public"."reservations" USING "btree" ("booking_id");



CREATE UNIQUE INDEX "reservations_external_source_id_room_idx" ON "public"."reservations" USING "btree" ("external_source", "external_id", "room_id") WHERE ("external_id" IS NOT NULL);



CREATE INDEX "tariffs_rate_idx" ON "public"."tariffs" USING "btree" ("rate_plan_id");



CREATE INDEX "tariffs_room_rate_idx" ON "public"."tariffs" USING "btree" ("room_type_id", "rate_plan_id");



CREATE INDEX "testimonials_published_idx" ON "public"."testimonials" USING "btree" ("is_published", "created_at" DESC);



CREATE INDEX "vikbooking_room_number_links_source_idx" ON "public"."vikbooking_room_number_links" USING "btree" ("source", "external_number_normalized");



CREATE OR REPLACE TRIGGER "after_profile_insert_set_owner" AFTER INSERT ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."set_first_user_as_owner"();



CREATE OR REPLACE TRIGGER "donations_set_updated_at" BEFORE UPDATE ON "public"."donations" FOR EACH ROW EXECUTE FUNCTION "public"."handle_donations_updated_at"();



CREATE OR REPLACE TRIGGER "external_room_links_touch_updated_at" BEFORE UPDATE ON "public"."external_room_links" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "import_job_entries_touch_updated_at" BEFORE UPDATE ON "public"."import_job_entries" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



CREATE OR REPLACE TRIGGER "reservations_booking_id_normalizer" BEFORE INSERT OR UPDATE ON "public"."reservations" FOR EACH ROW EXECUTE FUNCTION "public"."reservations_booking_id_normalizer"();



CREATE OR REPLACE TRIGGER "set_admin_activity_log_actor" BEFORE INSERT ON "public"."admin_activity_logs" FOR EACH ROW EXECUTE FUNCTION "public"."set_admin_activity_log_actor"();



CREATE OR REPLACE TRIGGER "trg_no_overlapping_reservations" BEFORE INSERT OR UPDATE ON "public"."reservations" FOR EACH ROW EXECUTE FUNCTION "public"."check_reservation_overlap"();



CREATE OR REPLACE TRIGGER "vikbooking_room_number_links_touch_updated_at" BEFORE UPDATE ON "public"."vikbooking_room_number_links" FOR EACH ROW EXECUTE FUNCTION "public"."touch_updated_at"();



ALTER TABLE ONLY "public"."booking_restrictions"
    ADD CONSTRAINT "booking_restrictions_room_type_id_fkey" FOREIGN KEY ("room_type_id") REFERENCES "public"."room_types"("id");



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."categories"("id");



ALTER TABLE ONLY "public"."event_banners"
    ADD CONSTRAINT "event_banners_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."external_room_links"
    ADD CONSTRAINT "external_room_links_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."folio_items"
    ADD CONSTRAINT "folio_items_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "public"."reservations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."housekeeping_assignments"
    ADD CONSTRAINT "housekeeping_assignments_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."housekeeping_assignments"
    ADD CONSTRAINT "housekeeping_assignments_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."import_job_entries"
    ADD CONSTRAINT "import_job_entries_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."import_jobs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."import_jobs"
    ADD CONSTRAINT "import_jobs_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."post_categories"
    ADD CONSTRAINT "post_categories_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."post_categories"
    ADD CONSTRAINT "post_categories_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."posts"
    ADD CONSTRAINT "posts_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."pricing_occupancy_rules"
    ADD CONSTRAINT "pricing_occupancy_rules_room_type_id_fkey" FOREIGN KEY ("room_type_id") REFERENCES "public"."room_types"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pricing_rates_grid"
    ADD CONSTRAINT "pricing_rates_grid_rate_plan_id_fkey" FOREIGN KEY ("rate_plan_id") REFERENCES "public"."rate_plans"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pricing_rates_grid"
    ADD CONSTRAINT "pricing_rates_grid_room_type_id_fkey" FOREIGN KEY ("room_type_id") REFERENCES "public"."room_types"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pricing_seasons"
    ADD CONSTRAINT "pricing_seasons_rate_plan_id_fkey" FOREIGN KEY ("rate_plan_id") REFERENCES "public"."rate_plans"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pricing_seasons"
    ADD CONSTRAINT "pricing_seasons_room_type_id_fkey" FOREIGN KEY ("room_type_id") REFERENCES "public"."room_types"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id");



ALTER TABLE ONLY "public"."property_closures"
    ADD CONSTRAINT "property_closures_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."property_closures"
    ADD CONSTRAINT "property_closures_room_type_id_fkey" FOREIGN KEY ("room_type_id") REFERENCES "public"."room_types"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rate_plans"
    ADD CONSTRAINT "rate_plans_derived_parent_id_fkey" FOREIGN KEY ("derived_parent_id") REFERENCES "public"."rate_plans"("id");



ALTER TABLE ONLY "public"."reservations"
    ADD CONSTRAINT "reservations_guest_id_fkey" FOREIGN KEY ("guest_id") REFERENCES "public"."guests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reservations"
    ADD CONSTRAINT "reservations_rate_plan_id_fkey" FOREIGN KEY ("rate_plan_id") REFERENCES "public"."rate_plans"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."reservations"
    ADD CONSTRAINT "reservations_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."room_type_amenities"
    ADD CONSTRAINT "room_type_amenities_amenity_id_fkey" FOREIGN KEY ("amenity_id") REFERENCES "public"."amenities"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."room_type_amenities"
    ADD CONSTRAINT "room_type_amenities_room_type_id_fkey" FOREIGN KEY ("room_type_id") REFERENCES "public"."room_types"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."room_types"
    ADD CONSTRAINT "room_types_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."room_categories"("id");



ALTER TABLE ONLY "public"."rooms"
    ADD CONSTRAINT "rooms_room_type_id_fkey" FOREIGN KEY ("room_type_id") REFERENCES "public"."room_types"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."seasonal_prices"
    ADD CONSTRAINT "seasonal_prices_room_type_id_fkey" FOREIGN KEY ("room_type_id") REFERENCES "public"."room_types"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sticky_notes"
    ADD CONSTRAINT "sticky_notes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tariffs"
    ADD CONSTRAINT "tariffs_rate_plan_id_fkey" FOREIGN KEY ("rate_plan_id") REFERENCES "public"."rate_plans"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tariffs"
    ADD CONSTRAINT "tariffs_room_type_id_fkey" FOREIGN KEY ("room_type_id") REFERENCES "public"."room_types"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."testimonials"
    ADD CONSTRAINT "testimonials_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."vikbooking_room_number_links"
    ADD CONSTRAINT "vikbooking_room_number_links_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE CASCADE;



CREATE POLICY "Allow anonymous users to insert reservations" ON "public"."reservations" FOR INSERT TO "anon" WITH CHECK (true);



CREATE POLICY "Allow authenticated manage property closures" ON "public"."property_closures" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Allow authenticated to read amenities" ON "public"."amenities" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow authenticated to read properties" ON "public"."properties" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow authenticated to read room types" ON "public"."room_types" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow authenticated to read rooms" ON "public"."rooms" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow authenticated users to delete reservations" ON "public"."reservations" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "Allow authenticated users to manage restrictions" ON "public"."booking_restrictions" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Allow authenticated users to read all reservations" ON "public"."reservations" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow authenticated users to update reservations" ON "public"."reservations" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Allow leadership to view admin activity logs" ON "public"."admin_activity_logs" FOR SELECT TO "authenticated" USING (("public"."get_user_role"("auth"."uid"()) = ANY (ARRAY['Hotel Owner'::"text", 'Hotel Manager'::"text"])));



CREATE POLICY "Allow managers to delete properties" ON "public"."properties" FOR DELETE TO "authenticated" USING ((("public"."get_user_role"("auth"."uid"()) = 'Hotel Manager'::"text") OR ("public"."get_user_role"("auth"."uid"()) = 'Hotel Owner'::"text")));



CREATE POLICY "Allow managers to insert properties" ON "public"."properties" FOR INSERT TO "authenticated" WITH CHECK ((("public"."get_user_role"("auth"."uid"()) = 'Hotel Manager'::"text") OR ("public"."get_user_role"("auth"."uid"()) = 'Hotel Owner'::"text")));



CREATE POLICY "Allow managers to manage room categories" ON "public"."room_categories" USING ("public"."user_has_permission"("auth"."uid"(), 'update:room_category'::"text"));



CREATE POLICY "Allow public read access to categories" ON "public"."categories" FOR SELECT USING (true);



CREATE POLICY "Allow public read access to post_categories" ON "public"."post_categories" FOR SELECT USING (true);



CREATE POLICY "Allow public read access to properties" ON "public"."properties" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "Allow public read access to published posts" ON "public"."posts" FOR SELECT USING ((("status" = 'published'::"text") OR ("auth"."uid"() IS NOT NULL)));



CREATE POLICY "Allow public read access to rate plans" ON "public"."rate_plans" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "Allow public read access to room categories" ON "public"."room_categories" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "Allow public read access to rooms" ON "public"."rooms" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "Allow public read folio_items" ON "public"."folio_items" FOR SELECT TO "anon" USING (true);



CREATE POLICY "Allow public read rate_plans" ON "public"."rate_plans" FOR SELECT TO "anon" USING (true);



CREATE POLICY "Allow public read rooms" ON "public"."rooms" FOR SELECT TO "anon" USING (true);



CREATE POLICY "Allow staff full access to categories" ON "public"."categories" USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Allow staff full access to post_categories" ON "public"."post_categories" USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Allow staff full access to posts" ON "public"."posts" USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Allow staff to create admin activity logs" ON "public"."admin_activity_logs" FOR INSERT TO "authenticated" WITH CHECK (("public"."get_user_role"("auth"."uid"()) = ANY (ARRAY['Hotel Owner'::"text", 'Hotel Manager'::"text", 'Receptionist'::"text", 'Housekeeper'::"text", 'Guest'::"text"])));



CREATE POLICY "Allow staff to read feedback" ON "public"."feedback" FOR SELECT TO "authenticated" USING ("public"."user_has_permission"("auth"."uid"(), 'read:feedback'::"text"));



CREATE POLICY "Allow staff to update feedback" ON "public"."feedback" FOR UPDATE TO "authenticated" USING ("public"."user_has_permission"("auth"."uid"(), 'update:feedback'::"text")) WITH CHECK ("public"."user_has_permission"("auth"."uid"(), 'update:feedback'::"text"));



CREATE POLICY "Allow users to manage amenities" ON "public"."amenities" TO "authenticated" USING ("public"."user_has_permission"("auth"."uid"(), 'update:setting'::"text")) WITH CHECK ("public"."user_has_permission"("auth"."uid"(), 'update:setting'::"text"));



CREATE POLICY "Allow users to update properties" ON "public"."properties" FOR UPDATE TO "authenticated" USING ("public"."user_has_permission"("auth"."uid"(), 'update:setting'::"text"));



CREATE POLICY "Amenities are public" ON "public"."amenities" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "Amenities deletes require permission" ON "public"."amenities" FOR DELETE TO "authenticated" USING ("public"."user_has_permission"("auth"."uid"(), 'update:setting'::"text"));



CREATE POLICY "Amenities require update setting permission" ON "public"."amenities" FOR INSERT TO "authenticated" WITH CHECK ("public"."user_has_permission"("auth"."uid"(), 'update:setting'::"text"));



CREATE POLICY "Amenities updates require permission" ON "public"."amenities" FOR UPDATE TO "authenticated" USING ("public"."user_has_permission"("auth"."uid"(), 'update:setting'::"text")) WITH CHECK ("public"."user_has_permission"("auth"."uid"(), 'update:setting'::"text"));



CREATE POLICY "Enable public read access to rate plans" ON "public"."rate_plans" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "Enable public read access to rooms" ON "public"."rooms" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "Folio items require read reservation permission" ON "public"."folio_items" FOR SELECT TO "authenticated" USING ("public"."user_has_permission"("auth"."uid"(), 'read:reservation'::"text"));



CREATE POLICY "Folio items require reservation delete" ON "public"."folio_items" FOR DELETE TO "authenticated" USING ("public"."user_has_permission"("auth"."uid"(), 'update:reservation'::"text"));



CREATE POLICY "Folio items require reservation update" ON "public"."folio_items" FOR UPDATE TO "authenticated" USING ("public"."user_has_permission"("auth"."uid"(), 'update:reservation'::"text")) WITH CHECK ("public"."user_has_permission"("auth"."uid"(), 'update:reservation'::"text"));



CREATE POLICY "Folio items require update reservation permission" ON "public"."folio_items" FOR INSERT TO "authenticated" WITH CHECK ("public"."user_has_permission"("auth"."uid"(), 'update:reservation'::"text"));



CREATE POLICY "Guests require create permission" ON "public"."guests" FOR INSERT TO "authenticated" WITH CHECK ("public"."user_has_permission"("auth"."uid"(), 'create:guest'::"text"));



CREATE POLICY "Guests require delete permission" ON "public"."guests" FOR DELETE TO "authenticated" USING ("public"."user_has_permission"("auth"."uid"(), 'delete:guest'::"text"));



CREATE POLICY "Guests require read permission" ON "public"."guests" FOR SELECT TO "authenticated" USING ("public"."user_has_permission"("auth"."uid"(), 'read:guest'::"text"));



CREATE POLICY "Guests require update permission" ON "public"."guests" FOR UPDATE TO "authenticated" USING ("public"."user_has_permission"("auth"."uid"(), 'update:guest'::"text")) WITH CHECK ("public"."user_has_permission"("auth"."uid"(), 'update:guest'::"text"));



CREATE POLICY "Housekeeping assignments deletes require permission" ON "public"."housekeeping_assignments" FOR DELETE TO "authenticated" USING ("public"."user_has_permission"("auth"."uid"(), 'update:room'::"text"));



CREATE POLICY "Housekeeping assignments require read room" ON "public"."housekeeping_assignments" FOR SELECT TO "authenticated" USING ("public"."user_has_permission"("auth"."uid"(), 'read:room'::"text"));



CREATE POLICY "Housekeeping assignments require update room" ON "public"."housekeeping_assignments" FOR INSERT TO "authenticated" WITH CHECK ("public"."user_has_permission"("auth"."uid"(), 'update:room'::"text"));



CREATE POLICY "Housekeeping assignments updates require permission" ON "public"."housekeeping_assignments" FOR UPDATE TO "authenticated" USING ("public"."user_has_permission"("auth"."uid"(), 'update:room'::"text")) WITH CHECK ("public"."user_has_permission"("auth"."uid"(), 'update:room'::"text"));



CREATE POLICY "Profiles: delete requires manage user" ON "public"."profiles" FOR DELETE TO "authenticated" USING (("public"."user_has_permission"("auth"."uid"(), 'delete:user'::"text") AND "public"."user_can_manage_user"("auth"."uid"(), "id")));



CREATE POLICY "Profiles: insert requires manage role" ON "public"."profiles" FOR INSERT TO "authenticated" WITH CHECK (("public"."user_has_permission"("auth"."uid"(), 'create:user'::"text") AND "public"."user_can_manage_role"("auth"."uid"(), "role_id")));



CREATE POLICY "Profiles: read requires permission" ON "public"."profiles" FOR SELECT TO "authenticated" USING ("public"."user_has_permission"("auth"."uid"(), 'read:user'::"text"));



CREATE POLICY "Profiles: self read" ON "public"."profiles" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "id"));



CREATE POLICY "Profiles: self update without role change" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "id")) WITH CHECK ((("auth"."uid"() = "id") AND ("role_id" = ( SELECT "profiles_1"."role_id"
   FROM "public"."profiles" "profiles_1"
  WHERE ("profiles_1"."id" = "auth"."uid"())))));



CREATE POLICY "Profiles: update requires manage user" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (("public"."user_has_permission"("auth"."uid"(), 'update:user'::"text") AND "public"."user_can_manage_user"("auth"."uid"(), "id"))) WITH CHECK (("public"."user_has_permission"("auth"."uid"(), 'update:user'::"text") AND "public"."user_can_manage_user"("auth"."uid"(), "id") AND "public"."user_can_manage_role"("auth"."uid"(), "role_id")));



CREATE POLICY "Properties deletes require permission" ON "public"."properties" FOR DELETE TO "authenticated" USING ("public"."user_has_permission"("auth"."uid"(), 'update:setting'::"text"));



CREATE POLICY "Properties inserts require permission" ON "public"."properties" FOR INSERT TO "authenticated" WITH CHECK ("public"."user_has_permission"("auth"."uid"(), 'update:setting'::"text"));



CREATE POLICY "Properties require settings permission" ON "public"."properties" FOR SELECT TO "authenticated" USING ("public"."user_has_permission"("auth"."uid"(), 'update:setting'::"text"));



CREATE POLICY "Properties updates require permission" ON "public"."properties" FOR UPDATE TO "authenticated" USING ("public"."user_has_permission"("auth"."uid"(), 'update:setting'::"text")) WITH CHECK ("public"."user_has_permission"("auth"."uid"(), 'update:setting'::"text"));



CREATE POLICY "Public can read active event banners" ON "public"."event_banners" FOR SELECT TO "authenticated", "anon" USING (("is_active" AND (("starts_at" IS NULL) OR ("starts_at" <= "now"())) AND (("ends_at" IS NULL) OR ("ends_at" >= "now"()))));



CREATE POLICY "Public can read published testimonials" ON "public"."testimonials" FOR SELECT TO "authenticated", "anon" USING (("is_published" IS TRUE));



CREATE POLICY "Public read access to occupancy rules" ON "public"."pricing_occupancy_rules" FOR SELECT USING (true);



CREATE POLICY "Public read access to pricing seasons" ON "public"."pricing_seasons" FOR SELECT USING (true);



CREATE POLICY "Public read access to rates grid" ON "public"."pricing_rates_grid" FOR SELECT USING (true);



CREATE POLICY "Rate plans require create permission" ON "public"."rate_plans" FOR INSERT TO "authenticated" WITH CHECK ("public"."user_has_permission"("auth"."uid"(), 'create:rate_plan'::"text"));



CREATE POLICY "Rate plans require delete permission" ON "public"."rate_plans" FOR DELETE TO "authenticated" USING ("public"."user_has_permission"("auth"."uid"(), 'delete:rate_plan'::"text"));



CREATE POLICY "Rate plans require update permission" ON "public"."rate_plans" FOR UPDATE TO "authenticated" USING ("public"."user_has_permission"("auth"."uid"(), 'update:rate_plan'::"text")) WITH CHECK ("public"."user_has_permission"("auth"."uid"(), 'update:rate_plan'::"text"));



CREATE POLICY "Reservations require create permission" ON "public"."reservations" FOR INSERT TO "authenticated" WITH CHECK ("public"."user_has_permission"("auth"."uid"(), 'create:reservation'::"text"));



CREATE POLICY "Reservations require delete permission" ON "public"."reservations" FOR DELETE TO "authenticated" USING ("public"."user_has_permission"("auth"."uid"(), 'delete:reservation'::"text"));



CREATE POLICY "Reservations require read permission" ON "public"."reservations" FOR SELECT TO "authenticated" USING ("public"."user_has_permission"("auth"."uid"(), 'read:reservation'::"text"));



CREATE POLICY "Reservations require update permission" ON "public"."reservations" FOR UPDATE TO "authenticated" USING ("public"."user_has_permission"("auth"."uid"(), 'update:reservation'::"text")) WITH CHECK ("public"."user_has_permission"("auth"."uid"(), 'update:reservation'::"text"));



CREATE POLICY "Roles: delete requires setting permission and manage target" ON "public"."roles" FOR DELETE TO "authenticated" USING (("public"."user_has_permission"("auth"."uid"(), 'update:setting'::"text") AND "public"."user_can_manage_role"("auth"."uid"(), "id")));



CREATE POLICY "Roles: insert requires setting permission and higher level" ON "public"."roles" FOR INSERT TO "authenticated" WITH CHECK (("public"."user_has_permission"("auth"."uid"(), 'update:setting'::"text") AND "public"."user_can_manage_role_level"("auth"."uid"(), COALESCE("hierarchy_level", 0))));



CREATE POLICY "Roles: select for authenticated" ON "public"."roles" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Roles: update requires setting permission and manage target" ON "public"."roles" FOR UPDATE TO "authenticated" USING (("public"."user_has_permission"("auth"."uid"(), 'update:setting'::"text") AND "public"."user_can_manage_role"("auth"."uid"(), "id"))) WITH CHECK (("public"."user_has_permission"("auth"."uid"(), 'update:setting'::"text") AND "public"."user_can_manage_role"("auth"."uid"(), "id") AND "public"."user_can_manage_role_level"("auth"."uid"(), COALESCE("hierarchy_level", 0))));



CREATE POLICY "Room categories require create permission" ON "public"."room_categories" FOR INSERT TO "authenticated" WITH CHECK ("public"."user_has_permission"("auth"."uid"(), 'create:room_category'::"text"));



CREATE POLICY "Room categories require delete permission" ON "public"."room_categories" FOR DELETE TO "authenticated" USING ("public"."user_has_permission"("auth"."uid"(), 'delete:room_category'::"text"));



CREATE POLICY "Room categories require update permission" ON "public"."room_categories" FOR UPDATE TO "authenticated" USING ("public"."user_has_permission"("auth"."uid"(), 'update:room_category'::"text")) WITH CHECK ("public"."user_has_permission"("auth"."uid"(), 'update:room_category'::"text"));



CREATE POLICY "Room type amenities are public" ON "public"."room_type_amenities" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "Room type amenities require delete permission" ON "public"."room_type_amenities" FOR DELETE TO "authenticated" USING ("public"."user_has_permission"("auth"."uid"(), 'update:room_type'::"text"));



CREATE POLICY "Room type amenities require update permission" ON "public"."room_type_amenities" FOR INSERT TO "authenticated" WITH CHECK ("public"."user_has_permission"("auth"."uid"(), 'update:room_type'::"text"));



CREATE POLICY "Room type amenities require update permission for changes" ON "public"."room_type_amenities" FOR UPDATE TO "authenticated" USING ("public"."user_has_permission"("auth"."uid"(), 'update:room_type'::"text")) WITH CHECK ("public"."user_has_permission"("auth"."uid"(), 'update:room_type'::"text"));



CREATE POLICY "Room types are public" ON "public"."room_types" FOR SELECT TO "authenticated", "anon" USING (COALESCE("is_visible", true));



CREATE POLICY "Room types require create permission" ON "public"."room_types" FOR INSERT TO "authenticated" WITH CHECK ("public"."user_has_permission"("auth"."uid"(), 'create:room_type'::"text"));



CREATE POLICY "Room types require delete permission" ON "public"."room_types" FOR DELETE TO "authenticated" USING ("public"."user_has_permission"("auth"."uid"(), 'delete:room_type'::"text"));



CREATE POLICY "Room types require update permission" ON "public"."room_types" FOR UPDATE TO "authenticated" USING ("public"."user_has_permission"("auth"."uid"(), 'update:room_type'::"text")) WITH CHECK ("public"."user_has_permission"("auth"."uid"(), 'update:room_type'::"text"));



CREATE POLICY "Rooms require create permission" ON "public"."rooms" FOR INSERT TO "authenticated" WITH CHECK ("public"."user_has_permission"("auth"."uid"(), 'create:room'::"text"));



CREATE POLICY "Rooms require delete permission" ON "public"."rooms" FOR DELETE TO "authenticated" USING ("public"."user_has_permission"("auth"."uid"(), 'delete:room'::"text"));



CREATE POLICY "Rooms require update permission" ON "public"."rooms" FOR UPDATE TO "authenticated" USING ("public"."user_has_permission"("auth"."uid"(), 'update:room'::"text")) WITH CHECK ("public"."user_has_permission"("auth"."uid"(), 'update:room'::"text"));



CREATE POLICY "Rooms: public read" ON "public"."rooms" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "Service role manages donations" ON "public"."donations" USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Service role manages external room links" ON "public"."external_room_links" USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Service role manages import job entries" ON "public"."import_job_entries" USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Service role manages import jobs" ON "public"."import_jobs" USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Service role manages manual_receipts" ON "public"."manual_receipts" USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Service role manages vikbooking room number links" ON "public"."vikbooking_room_number_links" USING (("auth"."role"() = 'service_role'::"text")) WITH CHECK (("auth"."role"() = 'service_role'::"text"));



CREATE POLICY "Staff can create donations" ON "public"."donations" FOR INSERT TO "authenticated" WITH CHECK ("public"."user_has_permission"("auth"."uid"(), 'create:donation'::"text"));



CREATE POLICY "Staff can create manual_receipts" ON "public"."manual_receipts" FOR INSERT TO "authenticated" WITH CHECK ("public"."user_has_permission"("auth"."uid"(), 'create:donation'::"text"));



CREATE POLICY "Staff can create reviews" ON "public"."testimonials" FOR INSERT TO "authenticated" WITH CHECK ("public"."user_has_permission"("auth"."uid"(), 'create:review'::"text"));



CREATE POLICY "Staff can delete donations" ON "public"."donations" FOR DELETE TO "authenticated" USING ("public"."user_has_permission"("auth"."uid"(), 'delete:donation'::"text"));



CREATE POLICY "Staff can delete event banners" ON "public"."event_banners" FOR DELETE TO "authenticated" USING ("public"."user_has_permission"("auth"."uid"(), 'update:setting'::"text"));



CREATE POLICY "Staff can delete manual_receipts" ON "public"."manual_receipts" FOR DELETE TO "authenticated" USING ("public"."user_has_permission"("auth"."uid"(), 'delete:donation'::"text"));



CREATE POLICY "Staff can delete reviews" ON "public"."testimonials" FOR DELETE TO "authenticated" USING ("public"."user_has_permission"("auth"."uid"(), 'delete:review'::"text"));



CREATE POLICY "Staff can read all event banners" ON "public"."event_banners" FOR SELECT TO "authenticated" USING ("public"."user_has_permission"("auth"."uid"(), 'update:setting'::"text"));



CREATE POLICY "Staff can read donations" ON "public"."donations" FOR SELECT TO "authenticated" USING ("public"."user_has_permission"("auth"."uid"(), 'read:donation'::"text"));



CREATE POLICY "Staff can read manual_receipts" ON "public"."manual_receipts" FOR SELECT TO "authenticated" USING ("public"."user_has_permission"("auth"."uid"(), 'read:donation'::"text"));



CREATE POLICY "Staff can read reviews" ON "public"."testimonials" FOR SELECT TO "authenticated" USING ("public"."user_has_permission"("auth"."uid"(), 'read:review'::"text"));



CREATE POLICY "Staff can update donations" ON "public"."donations" FOR UPDATE TO "authenticated" USING ("public"."user_has_permission"("auth"."uid"(), 'update:donation'::"text")) WITH CHECK ("public"."user_has_permission"("auth"."uid"(), 'update:donation'::"text"));



CREATE POLICY "Staff can update event banners" ON "public"."event_banners" FOR UPDATE TO "authenticated" USING ("public"."user_has_permission"("auth"."uid"(), 'update:setting'::"text")) WITH CHECK ("public"."user_has_permission"("auth"."uid"(), 'update:setting'::"text"));



CREATE POLICY "Staff can update manual_receipts" ON "public"."manual_receipts" FOR UPDATE TO "authenticated" USING ("public"."user_has_permission"("auth"."uid"(), 'update:donation'::"text")) WITH CHECK ("public"."user_has_permission"("auth"."uid"(), 'update:donation'::"text"));



CREATE POLICY "Staff can update reviews" ON "public"."testimonials" FOR UPDATE TO "authenticated" USING ("public"."user_has_permission"("auth"."uid"(), 'update:review'::"text")) WITH CHECK ("public"."user_has_permission"("auth"."uid"(), 'update:review'::"text"));



CREATE POLICY "Staff can upsert event banners" ON "public"."event_banners" FOR INSERT TO "authenticated" WITH CHECK ("public"."user_has_permission"("auth"."uid"(), 'update:setting'::"text"));



CREATE POLICY "Staff manage occupancy rules" ON "public"."pricing_occupancy_rules" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Staff manage pricing seasons" ON "public"."pricing_seasons" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Staff manage rates grid" ON "public"."pricing_rates_grid" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Users can manage their own sticky notes" ON "public"."sticky_notes" TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."admin_activity_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."amenities" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "anon_insert_guests" ON "public"."guests" FOR INSERT TO "anon" WITH CHECK (true);



CREATE POLICY "anon_insert_reservations" ON "public"."reservations" FOR INSERT TO "anon" WITH CHECK (("source" = 'website'::"text"));



CREATE POLICY "anon_select_guests" ON "public"."guests" FOR SELECT TO "anon" USING (true);



CREATE POLICY "anon_select_reservations" ON "public"."reservations" FOR SELECT TO "anon" USING (true);



ALTER TABLE "public"."booking_restrictions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."categories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."donations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."event_banners" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."external_room_links" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."feedback" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."folio_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."guests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."housekeeping_assignments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."import_job_entries" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."import_jobs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."manual_receipts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."post_categories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."posts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pricing_occupancy_rules" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pricing_rates_grid" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pricing_seasons" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."properties" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."property_closures" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."rate_plans" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "rate_plans_read_all" ON "public"."rate_plans" FOR SELECT USING (true);



ALTER TABLE "public"."reservations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."roles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."room_categories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."room_type_amenities" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "room_type_amenities_read_all" ON "public"."room_type_amenities" FOR SELECT USING (true);



ALTER TABLE "public"."room_types" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "room_types_read_all" ON "public"."room_types" FOR SELECT USING (true);



ALTER TABLE "public"."rooms" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "rooms_read_all" ON "public"."rooms" FOR SELECT USING (true);



ALTER TABLE "public"."seasonal_prices" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "seasonal_prices_authenticated_delete" ON "public"."seasonal_prices" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "seasonal_prices_authenticated_insert" ON "public"."seasonal_prices" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "seasonal_prices_authenticated_update" ON "public"."seasonal_prices" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "seasonal_prices_public_read" ON "public"."seasonal_prices" FOR SELECT TO "authenticated", "anon" USING (true);



ALTER TABLE "public"."sticky_notes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tariffs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tariffs_delete_auth" ON "public"."tariffs" FOR DELETE USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "tariffs_insert_auth" ON "public"."tariffs" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "tariffs_select_all" ON "public"."tariffs" FOR SELECT USING (true);



CREATE POLICY "tariffs_update_auth" ON "public"."tariffs" FOR UPDATE USING (("auth"."role"() = 'authenticated'::"text"));



ALTER TABLE "public"."testimonials" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."vikbooking_room_number_links" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."gbtreekey16_in"("cstring") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbtreekey16_in"("cstring") TO "anon";
GRANT ALL ON FUNCTION "public"."gbtreekey16_in"("cstring") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbtreekey16_in"("cstring") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbtreekey16_out"("public"."gbtreekey16") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbtreekey16_out"("public"."gbtreekey16") TO "anon";
GRANT ALL ON FUNCTION "public"."gbtreekey16_out"("public"."gbtreekey16") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbtreekey16_out"("public"."gbtreekey16") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbtreekey2_in"("cstring") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbtreekey2_in"("cstring") TO "anon";
GRANT ALL ON FUNCTION "public"."gbtreekey2_in"("cstring") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbtreekey2_in"("cstring") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbtreekey2_out"("public"."gbtreekey2") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbtreekey2_out"("public"."gbtreekey2") TO "anon";
GRANT ALL ON FUNCTION "public"."gbtreekey2_out"("public"."gbtreekey2") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbtreekey2_out"("public"."gbtreekey2") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbtreekey32_in"("cstring") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbtreekey32_in"("cstring") TO "anon";
GRANT ALL ON FUNCTION "public"."gbtreekey32_in"("cstring") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbtreekey32_in"("cstring") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbtreekey32_out"("public"."gbtreekey32") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbtreekey32_out"("public"."gbtreekey32") TO "anon";
GRANT ALL ON FUNCTION "public"."gbtreekey32_out"("public"."gbtreekey32") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbtreekey32_out"("public"."gbtreekey32") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbtreekey4_in"("cstring") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbtreekey4_in"("cstring") TO "anon";
GRANT ALL ON FUNCTION "public"."gbtreekey4_in"("cstring") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbtreekey4_in"("cstring") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbtreekey4_out"("public"."gbtreekey4") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbtreekey4_out"("public"."gbtreekey4") TO "anon";
GRANT ALL ON FUNCTION "public"."gbtreekey4_out"("public"."gbtreekey4") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbtreekey4_out"("public"."gbtreekey4") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbtreekey8_in"("cstring") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbtreekey8_in"("cstring") TO "anon";
GRANT ALL ON FUNCTION "public"."gbtreekey8_in"("cstring") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbtreekey8_in"("cstring") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbtreekey8_out"("public"."gbtreekey8") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbtreekey8_out"("public"."gbtreekey8") TO "anon";
GRANT ALL ON FUNCTION "public"."gbtreekey8_out"("public"."gbtreekey8") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbtreekey8_out"("public"."gbtreekey8") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbtreekey_var_in"("cstring") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbtreekey_var_in"("cstring") TO "anon";
GRANT ALL ON FUNCTION "public"."gbtreekey_var_in"("cstring") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbtreekey_var_in"("cstring") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbtreekey_var_out"("public"."gbtreekey_var") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbtreekey_var_out"("public"."gbtreekey_var") TO "anon";
GRANT ALL ON FUNCTION "public"."gbtreekey_var_out"("public"."gbtreekey_var") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbtreekey_var_out"("public"."gbtreekey_var") TO "service_role";

























































































































































GRANT ALL ON FUNCTION "public"."calculate_booking_total"("p_room_type_id" "uuid", "p_rate_plan_id" "uuid", "p_check_in" "date", "p_check_out" "date", "p_adults" integer, "p_children" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_booking_total"("p_room_type_id" "uuid", "p_rate_plan_id" "uuid", "p_check_in" "date", "p_check_out" "date", "p_adults" integer, "p_children" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_booking_total"("p_room_type_id" "uuid", "p_rate_plan_id" "uuid", "p_check_in" "date", "p_check_out" "date", "p_adults" integer, "p_children" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."cash_dist"("money", "money") TO "postgres";
GRANT ALL ON FUNCTION "public"."cash_dist"("money", "money") TO "anon";
GRANT ALL ON FUNCTION "public"."cash_dist"("money", "money") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cash_dist"("money", "money") TO "service_role";



GRANT ALL ON FUNCTION "public"."check_reservation_overlap"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_reservation_overlap"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_reservation_overlap"() TO "service_role";



GRANT ALL ON TABLE "public"."reservations" TO "anon";
GRANT ALL ON TABLE "public"."reservations" TO "authenticated";
GRANT ALL ON TABLE "public"."reservations" TO "service_role";



REVOKE ALL ON FUNCTION "public"."create_reservations_with_total"("p_booking_id" "text", "p_guest_id" "uuid", "p_room_ids" "uuid"[], "p_rate_plan_id" "uuid", "p_check_in_date" "date", "p_check_out_date" "date", "p_number_of_guests" integer, "p_status" "text", "p_notes" "text", "p_booking_date" timestamp with time zone, "p_source" "text", "p_payment_method" "text", "p_adult_count" integer, "p_child_count" integer, "p_tax_enabled_snapshot" boolean, "p_tax_rate_snapshot" numeric, "p_custom_totals" numeric[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_reservations_with_total"("p_booking_id" "text", "p_guest_id" "uuid", "p_room_ids" "uuid"[], "p_rate_plan_id" "uuid", "p_check_in_date" "date", "p_check_out_date" "date", "p_number_of_guests" integer, "p_status" "text", "p_notes" "text", "p_booking_date" timestamp with time zone, "p_source" "text", "p_payment_method" "text", "p_adult_count" integer, "p_child_count" integer, "p_tax_enabled_snapshot" boolean, "p_tax_rate_snapshot" numeric, "p_custom_totals" numeric[]) TO "anon";
GRANT ALL ON FUNCTION "public"."create_reservations_with_total"("p_booking_id" "text", "p_guest_id" "uuid", "p_room_ids" "uuid"[], "p_rate_plan_id" "uuid", "p_check_in_date" "date", "p_check_out_date" "date", "p_number_of_guests" integer, "p_status" "text", "p_notes" "text", "p_booking_date" timestamp with time zone, "p_source" "text", "p_payment_method" "text", "p_adult_count" integer, "p_child_count" integer, "p_tax_enabled_snapshot" boolean, "p_tax_rate_snapshot" numeric, "p_custom_totals" numeric[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_reservations_with_total"("p_booking_id" "text", "p_guest_id" "uuid", "p_room_ids" "uuid"[], "p_rate_plan_id" "uuid", "p_check_in_date" "date", "p_check_out_date" "date", "p_number_of_guests" integer, "p_status" "text", "p_notes" "text", "p_booking_date" timestamp with time zone, "p_source" "text", "p_payment_method" "text", "p_adult_count" integer, "p_child_count" integer, "p_tax_enabled_snapshot" boolean, "p_tax_rate_snapshot" numeric, "p_custom_totals" numeric[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."date_dist"("date", "date") TO "postgres";
GRANT ALL ON FUNCTION "public"."date_dist"("date", "date") TO "anon";
GRANT ALL ON FUNCTION "public"."date_dist"("date", "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."date_dist"("date", "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."float4_dist"(real, real) TO "postgres";
GRANT ALL ON FUNCTION "public"."float4_dist"(real, real) TO "anon";
GRANT ALL ON FUNCTION "public"."float4_dist"(real, real) TO "authenticated";
GRANT ALL ON FUNCTION "public"."float4_dist"(real, real) TO "service_role";



GRANT ALL ON FUNCTION "public"."float8_dist"(double precision, double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."float8_dist"(double precision, double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."float8_dist"(double precision, double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."float8_dist"(double precision, double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bit_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bit_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bit_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bit_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bit_consistent"("internal", bit, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bit_consistent"("internal", bit, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bit_consistent"("internal", bit, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bit_consistent"("internal", bit, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bit_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bit_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bit_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bit_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bit_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bit_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bit_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bit_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bit_same"("public"."gbtreekey_var", "public"."gbtreekey_var", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bit_same"("public"."gbtreekey_var", "public"."gbtreekey_var", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bit_same"("public"."gbtreekey_var", "public"."gbtreekey_var", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bit_same"("public"."gbtreekey_var", "public"."gbtreekey_var", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bit_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bit_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bit_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bit_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bool_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bool_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bool_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bool_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bool_consistent"("internal", boolean, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bool_consistent"("internal", boolean, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bool_consistent"("internal", boolean, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bool_consistent"("internal", boolean, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bool_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bool_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bool_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bool_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bool_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bool_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bool_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bool_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bool_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bool_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bool_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bool_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bool_same"("public"."gbtreekey2", "public"."gbtreekey2", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bool_same"("public"."gbtreekey2", "public"."gbtreekey2", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bool_same"("public"."gbtreekey2", "public"."gbtreekey2", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bool_same"("public"."gbtreekey2", "public"."gbtreekey2", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bool_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bool_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bool_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bool_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bpchar_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bpchar_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bpchar_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bpchar_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bpchar_consistent"("internal", character, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bpchar_consistent"("internal", character, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bpchar_consistent"("internal", character, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bpchar_consistent"("internal", character, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bytea_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bytea_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bytea_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bytea_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bytea_consistent"("internal", "bytea", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bytea_consistent"("internal", "bytea", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bytea_consistent"("internal", "bytea", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bytea_consistent"("internal", "bytea", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bytea_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bytea_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bytea_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bytea_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bytea_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bytea_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bytea_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bytea_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bytea_same"("public"."gbtreekey_var", "public"."gbtreekey_var", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bytea_same"("public"."gbtreekey_var", "public"."gbtreekey_var", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bytea_same"("public"."gbtreekey_var", "public"."gbtreekey_var", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bytea_same"("public"."gbtreekey_var", "public"."gbtreekey_var", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bytea_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bytea_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bytea_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bytea_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_cash_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_cash_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_cash_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_cash_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_cash_consistent"("internal", "money", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_cash_consistent"("internal", "money", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_cash_consistent"("internal", "money", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_cash_consistent"("internal", "money", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_cash_distance"("internal", "money", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_cash_distance"("internal", "money", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_cash_distance"("internal", "money", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_cash_distance"("internal", "money", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_cash_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_cash_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_cash_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_cash_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_cash_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_cash_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_cash_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_cash_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_cash_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_cash_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_cash_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_cash_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_cash_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_cash_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_cash_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_cash_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_cash_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_cash_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_cash_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_cash_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_date_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_date_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_date_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_date_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_date_consistent"("internal", "date", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_date_consistent"("internal", "date", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_date_consistent"("internal", "date", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_date_consistent"("internal", "date", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_date_distance"("internal", "date", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_date_distance"("internal", "date", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_date_distance"("internal", "date", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_date_distance"("internal", "date", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_date_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_date_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_date_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_date_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_date_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_date_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_date_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_date_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_date_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_date_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_date_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_date_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_date_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_date_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_date_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_date_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_date_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_date_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_date_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_date_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_decompress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_decompress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_decompress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_decompress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_enum_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_enum_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_enum_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_enum_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_enum_consistent"("internal", "anyenum", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_enum_consistent"("internal", "anyenum", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_enum_consistent"("internal", "anyenum", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_enum_consistent"("internal", "anyenum", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_enum_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_enum_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_enum_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_enum_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_enum_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_enum_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_enum_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_enum_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_enum_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_enum_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_enum_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_enum_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_enum_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_enum_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_enum_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_enum_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_enum_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_enum_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_enum_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_enum_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_float4_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_float4_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_float4_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_float4_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_float4_consistent"("internal", real, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_float4_consistent"("internal", real, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_float4_consistent"("internal", real, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_float4_consistent"("internal", real, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_float4_distance"("internal", real, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_float4_distance"("internal", real, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_float4_distance"("internal", real, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_float4_distance"("internal", real, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_float4_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_float4_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_float4_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_float4_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_float4_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_float4_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_float4_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_float4_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_float4_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_float4_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_float4_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_float4_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_float4_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_float4_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_float4_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_float4_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_float4_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_float4_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_float4_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_float4_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_float8_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_float8_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_float8_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_float8_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_float8_consistent"("internal", double precision, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_float8_consistent"("internal", double precision, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_float8_consistent"("internal", double precision, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_float8_consistent"("internal", double precision, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_float8_distance"("internal", double precision, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_float8_distance"("internal", double precision, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_float8_distance"("internal", double precision, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_float8_distance"("internal", double precision, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_float8_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_float8_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_float8_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_float8_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_float8_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_float8_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_float8_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_float8_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_float8_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_float8_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_float8_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_float8_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_float8_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_float8_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_float8_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_float8_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_float8_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_float8_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_float8_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_float8_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_inet_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_inet_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_inet_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_inet_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_inet_consistent"("internal", "inet", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_inet_consistent"("internal", "inet", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_inet_consistent"("internal", "inet", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_inet_consistent"("internal", "inet", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_inet_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_inet_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_inet_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_inet_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_inet_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_inet_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_inet_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_inet_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_inet_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_inet_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_inet_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_inet_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_inet_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_inet_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_inet_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_inet_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int2_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int2_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int2_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int2_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int2_consistent"("internal", smallint, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int2_consistent"("internal", smallint, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int2_consistent"("internal", smallint, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int2_consistent"("internal", smallint, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int2_distance"("internal", smallint, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int2_distance"("internal", smallint, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int2_distance"("internal", smallint, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int2_distance"("internal", smallint, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int2_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int2_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int2_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int2_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int2_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int2_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int2_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int2_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int2_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int2_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int2_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int2_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int2_same"("public"."gbtreekey4", "public"."gbtreekey4", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int2_same"("public"."gbtreekey4", "public"."gbtreekey4", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int2_same"("public"."gbtreekey4", "public"."gbtreekey4", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int2_same"("public"."gbtreekey4", "public"."gbtreekey4", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int2_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int2_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int2_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int2_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int4_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int4_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int4_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int4_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int4_consistent"("internal", integer, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int4_consistent"("internal", integer, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int4_consistent"("internal", integer, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int4_consistent"("internal", integer, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int4_distance"("internal", integer, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int4_distance"("internal", integer, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int4_distance"("internal", integer, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int4_distance"("internal", integer, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int4_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int4_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int4_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int4_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int4_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int4_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int4_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int4_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int4_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int4_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int4_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int4_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int4_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int4_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int4_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int4_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int4_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int4_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int4_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int4_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int8_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int8_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int8_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int8_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int8_consistent"("internal", bigint, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int8_consistent"("internal", bigint, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int8_consistent"("internal", bigint, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int8_consistent"("internal", bigint, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int8_distance"("internal", bigint, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int8_distance"("internal", bigint, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int8_distance"("internal", bigint, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int8_distance"("internal", bigint, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int8_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int8_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int8_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int8_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int8_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int8_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int8_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int8_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int8_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int8_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int8_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int8_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int8_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int8_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int8_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int8_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int8_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int8_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int8_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int8_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_intv_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_intv_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_intv_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_intv_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_intv_consistent"("internal", interval, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_intv_consistent"("internal", interval, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_intv_consistent"("internal", interval, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_intv_consistent"("internal", interval, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_intv_decompress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_intv_decompress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_intv_decompress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_intv_decompress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_intv_distance"("internal", interval, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_intv_distance"("internal", interval, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_intv_distance"("internal", interval, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_intv_distance"("internal", interval, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_intv_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_intv_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_intv_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_intv_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_intv_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_intv_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_intv_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_intv_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_intv_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_intv_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_intv_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_intv_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_intv_same"("public"."gbtreekey32", "public"."gbtreekey32", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_intv_same"("public"."gbtreekey32", "public"."gbtreekey32", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_intv_same"("public"."gbtreekey32", "public"."gbtreekey32", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_intv_same"("public"."gbtreekey32", "public"."gbtreekey32", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_intv_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_intv_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_intv_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_intv_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_macad8_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_macad8_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_macad8_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_macad8_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_macad8_consistent"("internal", "macaddr8", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_macad8_consistent"("internal", "macaddr8", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_macad8_consistent"("internal", "macaddr8", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_macad8_consistent"("internal", "macaddr8", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_macad8_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_macad8_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_macad8_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_macad8_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_macad8_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_macad8_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_macad8_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_macad8_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_macad8_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_macad8_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_macad8_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_macad8_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_macad8_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_macad8_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_macad8_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_macad8_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_macad8_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_macad8_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_macad8_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_macad8_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_macad_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_macad_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_macad_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_macad_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_macad_consistent"("internal", "macaddr", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_macad_consistent"("internal", "macaddr", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_macad_consistent"("internal", "macaddr", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_macad_consistent"("internal", "macaddr", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_macad_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_macad_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_macad_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_macad_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_macad_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_macad_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_macad_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_macad_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_macad_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_macad_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_macad_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_macad_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_macad_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_macad_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_macad_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_macad_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_macad_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_macad_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_macad_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_macad_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_numeric_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_numeric_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_numeric_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_numeric_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_numeric_consistent"("internal", numeric, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_numeric_consistent"("internal", numeric, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_numeric_consistent"("internal", numeric, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_numeric_consistent"("internal", numeric, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_numeric_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_numeric_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_numeric_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_numeric_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_numeric_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_numeric_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_numeric_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_numeric_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_numeric_same"("public"."gbtreekey_var", "public"."gbtreekey_var", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_numeric_same"("public"."gbtreekey_var", "public"."gbtreekey_var", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_numeric_same"("public"."gbtreekey_var", "public"."gbtreekey_var", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_numeric_same"("public"."gbtreekey_var", "public"."gbtreekey_var", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_numeric_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_numeric_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_numeric_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_numeric_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_oid_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_oid_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_oid_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_oid_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_oid_consistent"("internal", "oid", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_oid_consistent"("internal", "oid", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_oid_consistent"("internal", "oid", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_oid_consistent"("internal", "oid", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_oid_distance"("internal", "oid", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_oid_distance"("internal", "oid", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_oid_distance"("internal", "oid", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_oid_distance"("internal", "oid", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_oid_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_oid_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_oid_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_oid_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_oid_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_oid_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_oid_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_oid_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_oid_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_oid_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_oid_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_oid_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_oid_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_oid_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_oid_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_oid_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_oid_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_oid_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_oid_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_oid_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_text_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_text_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_text_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_text_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_text_consistent"("internal", "text", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_text_consistent"("internal", "text", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_text_consistent"("internal", "text", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_text_consistent"("internal", "text", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_text_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_text_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_text_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_text_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_text_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_text_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_text_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_text_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_text_same"("public"."gbtreekey_var", "public"."gbtreekey_var", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_text_same"("public"."gbtreekey_var", "public"."gbtreekey_var", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_text_same"("public"."gbtreekey_var", "public"."gbtreekey_var", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_text_same"("public"."gbtreekey_var", "public"."gbtreekey_var", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_text_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_text_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_text_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_text_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_time_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_time_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_time_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_time_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_time_consistent"("internal", time without time zone, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_time_consistent"("internal", time without time zone, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_time_consistent"("internal", time without time zone, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_time_consistent"("internal", time without time zone, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_time_distance"("internal", time without time zone, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_time_distance"("internal", time without time zone, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_time_distance"("internal", time without time zone, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_time_distance"("internal", time without time zone, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_time_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_time_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_time_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_time_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_time_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_time_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_time_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_time_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_time_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_time_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_time_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_time_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_time_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_time_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_time_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_time_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_time_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_time_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_time_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_time_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_timetz_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_timetz_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_timetz_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_timetz_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_timetz_consistent"("internal", time with time zone, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_timetz_consistent"("internal", time with time zone, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_timetz_consistent"("internal", time with time zone, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_timetz_consistent"("internal", time with time zone, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_ts_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_ts_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_ts_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_ts_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_ts_consistent"("internal", timestamp without time zone, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_ts_consistent"("internal", timestamp without time zone, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_ts_consistent"("internal", timestamp without time zone, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_ts_consistent"("internal", timestamp without time zone, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_ts_distance"("internal", timestamp without time zone, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_ts_distance"("internal", timestamp without time zone, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_ts_distance"("internal", timestamp without time zone, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_ts_distance"("internal", timestamp without time zone, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_ts_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_ts_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_ts_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_ts_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_ts_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_ts_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_ts_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_ts_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_ts_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_ts_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_ts_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_ts_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_ts_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_ts_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_ts_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_ts_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_ts_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_ts_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_ts_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_ts_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_tstz_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_tstz_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_tstz_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_tstz_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_tstz_consistent"("internal", timestamp with time zone, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_tstz_consistent"("internal", timestamp with time zone, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_tstz_consistent"("internal", timestamp with time zone, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_tstz_consistent"("internal", timestamp with time zone, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_tstz_distance"("internal", timestamp with time zone, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_tstz_distance"("internal", timestamp with time zone, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_tstz_distance"("internal", timestamp with time zone, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_tstz_distance"("internal", timestamp with time zone, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_uuid_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_uuid_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_uuid_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_uuid_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_uuid_consistent"("internal", "uuid", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_uuid_consistent"("internal", "uuid", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_uuid_consistent"("internal", "uuid", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_uuid_consistent"("internal", "uuid", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_uuid_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_uuid_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_uuid_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_uuid_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_uuid_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_uuid_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_uuid_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_uuid_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_uuid_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_uuid_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_uuid_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_uuid_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_uuid_same"("public"."gbtreekey32", "public"."gbtreekey32", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_uuid_same"("public"."gbtreekey32", "public"."gbtreekey32", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_uuid_same"("public"."gbtreekey32", "public"."gbtreekey32", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_uuid_same"("public"."gbtreekey32", "public"."gbtreekey32", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_uuid_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_uuid_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_uuid_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_uuid_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_var_decompress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_var_decompress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_var_decompress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_var_decompress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_var_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_var_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_var_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_var_fetch"("internal") TO "service_role";



REVOKE ALL ON FUNCTION "public"."generate_booking_code"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."generate_booking_code"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_booking_code"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_booking_code"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_monthly_availability"("p_month_start" "date", "p_room_type_ids" "uuid"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."get_monthly_availability"("p_month_start" "date", "p_room_type_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_monthly_availability"("p_month_start" "date", "p_room_type_ids" "uuid"[]) TO "service_role";



GRANT ALL ON TABLE "public"."guests" TO "anon";
GRANT ALL ON TABLE "public"."guests" TO "authenticated";
GRANT ALL ON TABLE "public"."guests" TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_or_create_booking_guest"("p_first_name" "text", "p_last_name" "text", "p_email" "text", "p_phone" "text", "p_address" "text", "p_pincode" "text", "p_city" "text", "p_country" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_or_create_booking_guest"("p_first_name" "text", "p_last_name" "text", "p_email" "text", "p_phone" "text", "p_address" "text", "p_pincode" "text", "p_city" "text", "p_country" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_or_create_booking_guest"("p_first_name" "text", "p_last_name" "text", "p_email" "text", "p_phone" "text", "p_address" "text", "p_pincode" "text", "p_city" "text", "p_country" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_or_create_booking_guest"("p_first_name" "text", "p_last_name" "text", "p_email" "text", "p_phone" "text", "p_address" "text", "p_pincode" "text", "p_city" "text", "p_country" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_or_create_booking_guest"("p_first_name" "text", "p_last_name" "text", "p_email" "text", "p_phone" "text", "p_address" "text", "p_pincode" "text", "p_city" "text", "p_state" "text", "p_country" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_or_create_booking_guest"("p_first_name" "text", "p_last_name" "text", "p_email" "text", "p_phone" "text", "p_address" "text", "p_pincode" "text", "p_city" "text", "p_state" "text", "p_country" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_or_create_booking_guest"("p_first_name" "text", "p_last_name" "text", "p_email" "text", "p_phone" "text", "p_address" "text", "p_pincode" "text", "p_city" "text", "p_state" "text", "p_country" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_or_create_booking_guest"("p_first_name" "text", "p_last_name" "text", "p_email" "text", "p_phone" "text", "p_address" "text", "p_pincode" "text", "p_city" "text", "p_state" "text", "p_country" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_or_create_guest"("p_first_name" "text", "p_last_name" "text", "p_email" "text", "p_phone" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_or_create_guest"("p_first_name" "text", "p_last_name" "text", "p_email" "text", "p_phone" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_or_create_guest"("p_first_name" "text", "p_last_name" "text", "p_email" "text", "p_phone" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_or_create_guest"("p_first_name" "text", "p_last_name" "text", "p_email" "text", "p_phone" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_pricing_matrix"("p_room_type_ids" "uuid"[], "p_start" "date", "p_end" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."get_pricing_matrix"("p_room_type_ids" "uuid"[], "p_start" "date", "p_end" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_pricing_matrix"("p_room_type_ids" "uuid"[], "p_start" "date", "p_end" "date") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_total_bookings"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_total_bookings"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_total_bookings"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_total_bookings"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_role"("user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_role"("user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_role"("user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_donations_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_donations_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_donations_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."import_vikbooking_payload"("p_job_id" "uuid", "p_rows" "jsonb", "p_mark_complete" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."import_vikbooking_payload"("p_job_id" "uuid", "p_rows" "jsonb", "p_mark_complete" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."import_vikbooking_payload"("p_job_id" "uuid", "p_rows" "jsonb", "p_mark_complete" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."import_vikbooking_payload"("p_job_id" "uuid", "p_rows" "jsonb", "p_mark_complete" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."int2_dist"(smallint, smallint) TO "postgres";
GRANT ALL ON FUNCTION "public"."int2_dist"(smallint, smallint) TO "anon";
GRANT ALL ON FUNCTION "public"."int2_dist"(smallint, smallint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."int2_dist"(smallint, smallint) TO "service_role";



GRANT ALL ON FUNCTION "public"."int4_dist"(integer, integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."int4_dist"(integer, integer) TO "anon";
GRANT ALL ON FUNCTION "public"."int4_dist"(integer, integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."int4_dist"(integer, integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."int8_dist"(bigint, bigint) TO "postgres";
GRANT ALL ON FUNCTION "public"."int8_dist"(bigint, bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."int8_dist"(bigint, bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."int8_dist"(bigint, bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."interval_dist"(interval, interval) TO "postgres";
GRANT ALL ON FUNCTION "public"."interval_dist"(interval, interval) TO "anon";
GRANT ALL ON FUNCTION "public"."interval_dist"(interval, interval) TO "authenticated";
GRANT ALL ON FUNCTION "public"."interval_dist"(interval, interval) TO "service_role";



GRANT ALL ON TABLE "public"."admin_activity_logs" TO "anon";
GRANT ALL ON TABLE "public"."admin_activity_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_activity_logs" TO "service_role";



GRANT ALL ON FUNCTION "public"."log_admin_activity_rpc"("p_actor_user_id" "uuid", "p_section" "text", "p_action" "text", "p_actor_role" "text", "p_actor_name" "text", "p_entity_type" "text", "p_entity_id" "uuid", "p_entity_label" "text", "p_details" "text", "p_amount_minor" bigint, "p_metadata" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."log_admin_activity_rpc"("p_actor_user_id" "uuid", "p_section" "text", "p_action" "text", "p_actor_role" "text", "p_actor_name" "text", "p_entity_type" "text", "p_entity_id" "uuid", "p_entity_label" "text", "p_details" "text", "p_amount_minor" bigint, "p_metadata" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_admin_activity_rpc"("p_actor_user_id" "uuid", "p_section" "text", "p_action" "text", "p_actor_role" "text", "p_actor_name" "text", "p_entity_type" "text", "p_entity_id" "uuid", "p_entity_label" "text", "p_details" "text", "p_amount_minor" bigint, "p_metadata" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."normalize_booking_id"("raw_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."normalize_booking_id"("raw_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."normalize_booking_id"("raw_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."oid_dist"("oid", "oid") TO "postgres";
GRANT ALL ON FUNCTION "public"."oid_dist"("oid", "oid") TO "anon";
GRANT ALL ON FUNCTION "public"."oid_dist"("oid", "oid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."oid_dist"("oid", "oid") TO "service_role";



GRANT ALL ON FUNCTION "public"."reservations_booking_id_normalizer"() TO "anon";
GRANT ALL ON FUNCTION "public"."reservations_booking_id_normalizer"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."reservations_booking_id_normalizer"() TO "service_role";



GRANT ALL ON FUNCTION "public"."role_level"("role_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."role_level"("role_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."role_level"("role_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_admin_activity_log_actor"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_admin_activity_log_actor"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_admin_activity_log_actor"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_first_user_as_owner"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_first_user_as_owner"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_first_user_as_owner"() TO "service_role";



GRANT ALL ON FUNCTION "public"."time_dist"(time without time zone, time without time zone) TO "postgres";
GRANT ALL ON FUNCTION "public"."time_dist"(time without time zone, time without time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."time_dist"(time without time zone, time without time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."time_dist"(time without time zone, time without time zone) TO "service_role";



GRANT ALL ON TABLE "public"."event_banners" TO "anon";
GRANT ALL ON TABLE "public"."event_banners" TO "authenticated";
GRANT ALL ON TABLE "public"."event_banners" TO "service_role";



GRANT ALL ON FUNCTION "public"."toggle_event_banner"("target_event_id" "uuid", "new_status" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."toggle_event_banner"("target_event_id" "uuid", "new_status" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."toggle_event_banner"("target_event_id" "uuid", "new_status" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."touch_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."touch_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."touch_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."ts_dist"(timestamp without time zone, timestamp without time zone) TO "postgres";
GRANT ALL ON FUNCTION "public"."ts_dist"(timestamp without time zone, timestamp without time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."ts_dist"(timestamp without time zone, timestamp without time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."ts_dist"(timestamp without time zone, timestamp without time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."tstz_dist"(timestamp with time zone, timestamp with time zone) TO "postgres";
GRANT ALL ON FUNCTION "public"."tstz_dist"(timestamp with time zone, timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."tstz_dist"(timestamp with time zone, timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."tstz_dist"(timestamp with time zone, timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."upsert_room_type_with_amenities"("p_id" "uuid", "p_name" "text", "p_description" "text", "p_max_occupancy" integer, "p_bed_types" "text"[], "p_price" numeric, "p_photos" "text"[], "p_main_photo_url" "text", "p_amenity_ids" "uuid"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."upsert_room_type_with_amenities"("p_id" "uuid", "p_name" "text", "p_description" "text", "p_max_occupancy" integer, "p_bed_types" "text"[], "p_price" numeric, "p_photos" "text"[], "p_main_photo_url" "text", "p_amenity_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."upsert_room_type_with_amenities"("p_id" "uuid", "p_name" "text", "p_description" "text", "p_max_occupancy" integer, "p_bed_types" "text"[], "p_price" numeric, "p_photos" "text"[], "p_main_photo_url" "text", "p_amenity_ids" "uuid"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."upsert_room_type_with_amenities"("p_id" "uuid", "p_name" "text", "p_description" "text", "p_max_occupancy" integer, "p_bed_types" "text"[], "p_price" numeric, "p_photos" "text"[], "p_main_photo_url" "text", "p_amenity_ids" "uuid"[], "p_is_visible" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."upsert_room_type_with_amenities"("p_id" "uuid", "p_name" "text", "p_description" "text", "p_max_occupancy" integer, "p_bed_types" "text"[], "p_price" numeric, "p_photos" "text"[], "p_main_photo_url" "text", "p_amenity_ids" "uuid"[], "p_is_visible" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."upsert_room_type_with_amenities"("p_id" "uuid", "p_name" "text", "p_description" "text", "p_max_occupancy" integer, "p_bed_types" "text"[], "p_price" numeric, "p_photos" "text"[], "p_main_photo_url" "text", "p_amenity_ids" "uuid"[], "p_is_visible" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."user_can_manage_role"("actor_user_id" "uuid", "target_role_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."user_can_manage_role"("actor_user_id" "uuid", "target_role_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."user_can_manage_role"("actor_user_id" "uuid", "target_role_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."user_can_manage_role_level"("actor_user_id" "uuid", "target_level" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."user_can_manage_role_level"("actor_user_id" "uuid", "target_level" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."user_can_manage_role_level"("actor_user_id" "uuid", "target_level" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."user_can_manage_user"("actor_user_id" "uuid", "target_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."user_can_manage_user"("actor_user_id" "uuid", "target_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."user_can_manage_user"("actor_user_id" "uuid", "target_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."user_has_permission"("user_id" "uuid", "permission_text" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."user_has_permission"("user_id" "uuid", "permission_text" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."user_has_permission"("user_id" "uuid", "permission_text" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."user_role_level"("user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."user_role_level"("user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."user_role_level"("user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_booking_request"("p_check_in" "date", "p_check_out" "date", "p_room_id" "uuid", "p_adults" integer, "p_children" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."validate_booking_request"("p_check_in" "date", "p_check_out" "date", "p_room_id" "uuid", "p_adults" integer, "p_children" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_booking_request"("p_check_in" "date", "p_check_out" "date", "p_room_id" "uuid", "p_adults" integer, "p_children" integer) TO "service_role";


















GRANT ALL ON TABLE "public"."amenities" TO "anon";
GRANT ALL ON TABLE "public"."amenities" TO "authenticated";
GRANT ALL ON TABLE "public"."amenities" TO "service_role";



GRANT ALL ON SEQUENCE "public"."booking_code_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."booking_code_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."booking_code_seq" TO "service_role";



GRANT ALL ON TABLE "public"."booking_restrictions" TO "anon";
GRANT ALL ON TABLE "public"."booking_restrictions" TO "authenticated";
GRANT ALL ON TABLE "public"."booking_restrictions" TO "service_role";



GRANT ALL ON TABLE "public"."folio_items" TO "anon";
GRANT ALL ON TABLE "public"."folio_items" TO "authenticated";
GRANT ALL ON TABLE "public"."folio_items" TO "service_role";



GRANT ALL ON TABLE "public"."rooms" TO "anon";
GRANT ALL ON TABLE "public"."rooms" TO "authenticated";
GRANT ALL ON TABLE "public"."rooms" TO "service_role";



GRANT ALL ON TABLE "public"."bookings_summary_view" TO "anon";
GRANT ALL ON TABLE "public"."bookings_summary_view" TO "authenticated";
GRANT ALL ON TABLE "public"."bookings_summary_view" TO "service_role";



GRANT ALL ON TABLE "public"."categories" TO "anon";
GRANT ALL ON TABLE "public"."categories" TO "authenticated";
GRANT ALL ON TABLE "public"."categories" TO "service_role";



GRANT ALL ON TABLE "public"."donations" TO "anon";
GRANT ALL ON TABLE "public"."donations" TO "authenticated";
GRANT ALL ON TABLE "public"."donations" TO "service_role";



GRANT ALL ON TABLE "public"."donation_stats" TO "anon";
GRANT ALL ON TABLE "public"."donation_stats" TO "authenticated";
GRANT ALL ON TABLE "public"."donation_stats" TO "service_role";



GRANT ALL ON TABLE "public"."external_room_links" TO "anon";
GRANT ALL ON TABLE "public"."external_room_links" TO "authenticated";
GRANT ALL ON TABLE "public"."external_room_links" TO "service_role";



GRANT ALL ON TABLE "public"."feedback" TO "anon";
GRANT ALL ON TABLE "public"."feedback" TO "authenticated";
GRANT ALL ON TABLE "public"."feedback" TO "service_role";



GRANT ALL ON TABLE "public"."housekeeping_assignments" TO "anon";
GRANT ALL ON TABLE "public"."housekeeping_assignments" TO "authenticated";
GRANT ALL ON TABLE "public"."housekeeping_assignments" TO "service_role";



GRANT ALL ON TABLE "public"."import_job_entries" TO "anon";
GRANT ALL ON TABLE "public"."import_job_entries" TO "authenticated";
GRANT ALL ON TABLE "public"."import_job_entries" TO "service_role";



GRANT ALL ON TABLE "public"."import_jobs" TO "anon";
GRANT ALL ON TABLE "public"."import_jobs" TO "authenticated";
GRANT ALL ON TABLE "public"."import_jobs" TO "service_role";



GRANT ALL ON TABLE "public"."manual_receipts" TO "anon";
GRANT ALL ON TABLE "public"."manual_receipts" TO "authenticated";
GRANT ALL ON TABLE "public"."manual_receipts" TO "service_role";



GRANT ALL ON SEQUENCE "public"."manual_receipts_slip_no_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."manual_receipts_slip_no_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."manual_receipts_slip_no_seq" TO "service_role";



GRANT ALL ON TABLE "public"."post_categories" TO "anon";
GRANT ALL ON TABLE "public"."post_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."post_categories" TO "service_role";



GRANT ALL ON TABLE "public"."posts" TO "anon";
GRANT ALL ON TABLE "public"."posts" TO "authenticated";
GRANT ALL ON TABLE "public"."posts" TO "service_role";



GRANT ALL ON TABLE "public"."pricing_occupancy_rules" TO "anon";
GRANT ALL ON TABLE "public"."pricing_occupancy_rules" TO "authenticated";
GRANT ALL ON TABLE "public"."pricing_occupancy_rules" TO "service_role";



GRANT ALL ON TABLE "public"."pricing_rates_grid" TO "anon";
GRANT ALL ON TABLE "public"."pricing_rates_grid" TO "authenticated";
GRANT ALL ON TABLE "public"."pricing_rates_grid" TO "service_role";



GRANT ALL ON TABLE "public"."pricing_seasons" TO "anon";
GRANT ALL ON TABLE "public"."pricing_seasons" TO "authenticated";
GRANT ALL ON TABLE "public"."pricing_seasons" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."properties" TO "anon";
GRANT ALL ON TABLE "public"."properties" TO "authenticated";
GRANT ALL ON TABLE "public"."properties" TO "service_role";



GRANT ALL ON TABLE "public"."property_closures" TO "anon";
GRANT ALL ON TABLE "public"."property_closures" TO "authenticated";
GRANT ALL ON TABLE "public"."property_closures" TO "service_role";



GRANT ALL ON TABLE "public"."rate_plans" TO "anon";
GRANT ALL ON TABLE "public"."rate_plans" TO "authenticated";
GRANT ALL ON TABLE "public"."rate_plans" TO "service_role";



GRANT ALL ON TABLE "public"."reservation_activity_logs_vw" TO "anon";
GRANT ALL ON TABLE "public"."reservation_activity_logs_vw" TO "authenticated";
GRANT ALL ON TABLE "public"."reservation_activity_logs_vw" TO "service_role";



GRANT ALL ON TABLE "public"."reservations_booking_id_backup_20251216" TO "anon";
GRANT ALL ON TABLE "public"."reservations_booking_id_backup_20251216" TO "authenticated";
GRANT ALL ON TABLE "public"."reservations_booking_id_backup_20251216" TO "service_role";



GRANT ALL ON TABLE "public"."roles" TO "anon";
GRANT ALL ON TABLE "public"."roles" TO "authenticated";
GRANT ALL ON TABLE "public"."roles" TO "service_role";



GRANT ALL ON TABLE "public"."room_categories" TO "anon";
GRANT ALL ON TABLE "public"."room_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."room_categories" TO "service_role";



GRANT ALL ON TABLE "public"."room_type_amenities" TO "anon";
GRANT ALL ON TABLE "public"."room_type_amenities" TO "authenticated";
GRANT ALL ON TABLE "public"."room_type_amenities" TO "service_role";



GRANT ALL ON TABLE "public"."room_types" TO "anon";
GRANT ALL ON TABLE "public"."room_types" TO "authenticated";
GRANT ALL ON TABLE "public"."room_types" TO "service_role";



GRANT ALL ON TABLE "public"."seasonal_prices" TO "anon";
GRANT ALL ON TABLE "public"."seasonal_prices" TO "authenticated";
GRANT ALL ON TABLE "public"."seasonal_prices" TO "service_role";



GRANT ALL ON TABLE "public"."sticky_notes" TO "anon";
GRANT ALL ON TABLE "public"."sticky_notes" TO "authenticated";
GRANT ALL ON TABLE "public"."sticky_notes" TO "service_role";



GRANT ALL ON TABLE "public"."tariffs" TO "anon";
GRANT ALL ON TABLE "public"."tariffs" TO "authenticated";
GRANT ALL ON TABLE "public"."tariffs" TO "service_role";



GRANT ALL ON TABLE "public"."testimonials" TO "anon";
GRANT ALL ON TABLE "public"."testimonials" TO "authenticated";
GRANT ALL ON TABLE "public"."testimonials" TO "service_role";



GRANT ALL ON TABLE "public"."vikbooking_room_number_links" TO "anon";
GRANT ALL ON TABLE "public"."vikbooking_room_number_links" TO "authenticated";
GRANT ALL ON TABLE "public"."vikbooking_room_number_links" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";
































CREATE OR REPLACE FUNCTION public.upsert_room_type_with_amenities_minimal(
  p_id uuid,
  p_name text,
  p_description text,
  p_max_occupancy integer,
  p_bed_types text[],
  p_price numeric,
  p_photos text[],
  p_main_photo_url text,
  p_amenity_ids uuid[],
  p_is_visible boolean DEFAULT true
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_room_type_id uuid;
  v_result json;
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

  IF COALESCE(array_length(p_amenity_ids, 1), 0) > 0 THEN
    INSERT INTO public.room_type_amenities (room_type_id, amenity_id)
    SELECT v_room_type_id, unnest(p_amenity_ids);
  END IF;

  SELECT json_build_object(
    'id', rt.id,
    'min_occupancy', rt.min_occupancy,
    'max_children', rt.max_children,
    'category_id', rt.category_id
  )
  INTO v_result
  FROM public.room_types rt
  WHERE rt.id = v_room_type_id;

  RETURN v_result;
END;
$$;

GRANT ALL ON FUNCTION public.upsert_room_type_with_amenities_minimal(
  uuid,
  text,
  text,
  integer,
  text[],
  numeric,
  text[],
  text,
  uuid[],
  boolean
) TO anon;

GRANT ALL ON FUNCTION public.upsert_room_type_with_amenities_minimal(
  uuid,
  text,
  text,
  integer,
  text[],
  numeric,
  text[],
  text,
  uuid[],
  boolean
) TO authenticated;

GRANT ALL ON FUNCTION public.upsert_room_type_with_amenities_minimal(
  uuid,
  text,
  text,
  integer,
  text[],
  numeric,
  text[],
  text,
  uuid[],
  boolean
) TO service_role;

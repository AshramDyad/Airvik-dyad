SET search_path TO public;

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS seo_title text,
  ADD COLUMN IF NOT EXISTS meta_description text,
  ADD COLUMN IF NOT EXISTS focus_keyword text,
  ADD COLUMN IF NOT EXISTS target_keywords text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS featured_image_alt text,
  ADD COLUMN IF NOT EXISTS seo_notes text,
  ADD COLUMN IF NOT EXISTS source_query_data jsonb NOT NULL DEFAULT '[]'::jsonb;

INSERT INTO public.categories (name, slug, description)
VALUES
  ('Ashram Stays', 'ashram-stays', 'Practical guides to staying at an ashram in Rishikesh.'),
  ('Dharamshala & Locations', 'dharamshala-locations', 'Dharamshala, neighbourhood and location guides for Rishikesh.'),
  ('Budget & Community Meals', 'budget-community-meals', 'Budget stays, community meals and practical cost guidance.'),
  ('Yoga & Spiritual Life', 'yoga-spiritual-life', 'Yoga, meditation, Ganga Aarti and spiritual life in Rishikesh.')
ON CONFLICT (slug) DO NOTHING;

-- ROLLBACK:
-- ALTER TABLE public.posts
--   DROP COLUMN IF EXISTS seo_title,
--   DROP COLUMN IF EXISTS meta_description,
--   DROP COLUMN IF EXISTS focus_keyword,
--   DROP COLUMN IF EXISTS target_keywords,
--   DROP COLUMN IF EXISTS featured_image_alt,
--   DROP COLUMN IF EXISTS seo_notes,
--   DROP COLUMN IF EXISTS source_query_data;
-- DELETE FROM public.categories
-- WHERE slug IN ('ashram-stays', 'dharamshala-locations', 'budget-community-meals', 'yoga-spiritual-life');

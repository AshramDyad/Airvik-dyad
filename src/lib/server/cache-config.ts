export const REVIEW_SELECT_COLUMNS =
  "id, reviewer_name, reviewer_title, content, image_url, is_published, created_at, updated_at, updated_by" as const;
export const REVIEW_CREATE_RETURN_COLUMNS =
  "id, created_at, updated_at" as const;
export const PUBLIC_REVIEW_SELECT_COLUMNS =
  "reviewer_name, reviewer_title, content, image_url" as const;

export const REVIEWS_CACHE_TAG = "reviews";
export const REVIEWS_REVALIDATE_SECONDS = 300;
export const PUBLIC_REVIEWS_MAX_LIMIT = 20;

export const EVENT_SELECT_COLUMNS =
  "id, title, description, image_url, is_active, starts_at, ends_at, created_at, updated_at, updated_by" as const;
export const EVENT_CREATE_RETURN_COLUMNS =
  "id, created_at, updated_at" as const;
export const PUBLIC_HOMEPAGE_BANNER_SELECT_COLUMNS =
  "title, description, image_url, starts_at, ends_at" as const;

export const EVENT_BANNERS_CACHE_TAG = "event-banners";
export const EVENTS_REVALIDATE_SECONDS = 60;

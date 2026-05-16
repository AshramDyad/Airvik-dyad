export const ADMIN_FEEDBACK_SELECT_COLUMNS =
  "id, feedback_type, message, name, is_anonymous, email, room_or_facility, rating, status, internal_note, created_at, updated_at" as const;
export const ADMIN_FEEDBACK_PATCH_RETURN_COLUMNS =
  "id, name, email, status, internal_note, updated_at" as const;

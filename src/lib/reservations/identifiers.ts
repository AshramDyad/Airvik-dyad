const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isReservationUuid = (
  value: string | null | undefined
): value is string => Boolean(value && UUID_PATTERN.test(value));

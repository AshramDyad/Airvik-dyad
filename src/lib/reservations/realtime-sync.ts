export const RESERVATION_SYNC_CHANNEL = "airvik:reservations";
export const RESERVATION_SYNC_STORAGE_KEY = "airvik:reservations:changed";
export const RESERVATION_SYNC_MESSAGE_TYPE = "reservations:changed";

export type ReservationSyncHint = {
  reservationId?: string;
  bookingId?: string;
};

export type ReservationSyncMessage = ReservationSyncHint & {
  type: typeof RESERVATION_SYNC_MESSAGE_TYPE;
  sourceId: string;
  revision: number;
  createdAt: number;
};

export type ReservationRealtimeRow = {
  id?: string | null;
  booking_id?: string | null;
};

export type FolioItemRealtimeRow = {
  reservation_id?: string | null;
};

type CreateReservationSyncMessageArgs = ReservationSyncHint & {
  sourceId: string;
  revision: number;
  createdAt?: number;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const readOptionalString = (
  value: Record<string, unknown>,
  key: string
): string | undefined => {
  const entry = value[key];
  return typeof entry === "string" && entry.length > 0 ? entry : undefined;
};

export function createReservationSyncSourceId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export function createReservationSyncMessage({
  sourceId,
  revision,
  reservationId,
  bookingId,
  createdAt = Date.now(),
}: CreateReservationSyncMessageArgs): ReservationSyncMessage {
  return {
    type: RESERVATION_SYNC_MESSAGE_TYPE,
    sourceId,
    revision,
    createdAt,
    ...(reservationId ? { reservationId } : {}),
    ...(bookingId ? { bookingId } : {}),
  };
}

export function parseReservationSyncMessage(
  value: unknown
): ReservationSyncMessage | null {
  if (!isRecord(value)) {
    return null;
  }

  if (value.type !== RESERVATION_SYNC_MESSAGE_TYPE) {
    return null;
  }

  const sourceId = readOptionalString(value, "sourceId");
  const revision = value.revision;
  const createdAt = value.createdAt;

  if (
    !sourceId ||
    typeof revision !== "number" ||
    !Number.isFinite(revision) ||
    typeof createdAt !== "number" ||
    !Number.isFinite(createdAt)
  ) {
    return null;
  }

  return {
    type: RESERVATION_SYNC_MESSAGE_TYPE,
    sourceId,
    revision,
    createdAt,
    ...(readOptionalString(value, "reservationId")
      ? { reservationId: readOptionalString(value, "reservationId") }
      : {}),
    ...(readOptionalString(value, "bookingId")
      ? { bookingId: readOptionalString(value, "bookingId") }
      : {}),
  };
}

export function parseReservationSyncStorageValue(
  value: string | null
): ReservationSyncMessage | null {
  if (!value) {
    return null;
  }

  try {
    return parseReservationSyncMessage(JSON.parse(value) as unknown);
  } catch {
    return null;
  }
}

export function getReservationRealtimeHint(
  row: Partial<ReservationRealtimeRow>
): ReservationSyncHint {
  return {
    ...(row.id ? { reservationId: row.id } : {}),
    ...(row.booking_id ? { bookingId: row.booking_id } : {}),
  };
}

export function getFolioItemRealtimeHint(
  row: Partial<FolioItemRealtimeRow>
): ReservationSyncHint {
  return {
    ...(row.reservation_id ? { reservationId: row.reservation_id } : {}),
  };
}

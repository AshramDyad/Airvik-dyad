import "server-only";

import type {
  FolioItem,
  Guest,
  Reservation,
  ReservationStatus,
  Room,
  RoomType,
} from "@/data/types";
import { createServerSupabaseClient } from "@/integrations/supabase/server";

const PUBLIC_CONFIRMATION_FOLIO_SELECT =
  "id, reservation_id, description, amount, timestamp, payment_method, transaction_id, external_source, external_reference, external_metadata" as const;

export const PUBLIC_CONFIRMATION_RESERVATION_SELECT =
  `id, booking_id, guest_id, room_id, rate_plan_id, check_in_date, check_out_date, number_of_guests, status, notes, total_amount, booking_date, source, payment_method, adult_count, child_count, tax_enabled_snapshot, tax_rate_snapshot, external_source, external_id, external_metadata, folio:folio_items(${PUBLIC_CONFIRMATION_FOLIO_SELECT})` as const;
export const PUBLIC_CONFIRMATION_GUEST_SELECT =
  "id, first_name, last_name, email, phone, address, pincode, city, state, country" as const;
export const PUBLIC_CONFIRMATION_ROOM_SELECT =
  "id, room_number, room_type_id, status, photos" as const;
export const PUBLIC_CONFIRMATION_ROOM_TYPE_SELECT =
  "id, name, description, max_occupancy, min_occupancy, max_children, category_id, bed_types, price, photos, main_photo_url, is_visible" as const;

export type PublicBookingConfirmation = {
  reservation: Reservation;
  bookingReservations: Reservation[];
  guest: Guest | null;
  rooms: Room[];
  roomTypes: RoomType[];
};

export class BookingConfirmationError extends Error {
  readonly statusCode: number;
  readonly code: string;

  constructor(
    message: string,
    statusCode = 500,
    code = "BOOKING_CONFIRMATION_ERROR",
  ) {
    super(message);
    this.name = "BookingConfirmationError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

type QueryResponse<T> = {
  data: T[] | null;
  error: unknown;
};

type DbFolioItem = {
  id: string;
  reservation_id: string;
  description: string;
  amount: number;
  timestamp: string;
  payment_method: string | null;
  transaction_id: string | null;
  external_source: string | null;
  external_reference: string | null;
  external_metadata: Record<string, unknown> | null;
};

type DbReservation = {
  id: string;
  booking_id: string;
  guest_id: string;
  room_id: string;
  rate_plan_id: string | null;
  check_in_date: string;
  check_out_date: string;
  number_of_guests: number;
  status: ReservationStatus;
  notes: string | null;
  folio?: DbFolioItem[] | null;
  total_amount: number;
  booking_date: string;
  source: Reservation["source"];
  payment_method: Reservation["paymentMethod"] | null;
  adult_count: number | null;
  child_count: number | null;
  tax_enabled_snapshot: boolean | null;
  tax_rate_snapshot: number | null;
  external_source: string | null;
  external_id: string | null;
  external_metadata: Record<string, unknown> | null;
};

type DbGuest = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  pincode: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
};

type DbRoom = {
  id: string;
  room_number: string;
  room_type_id: string;
  status: Room["status"];
  photos: string[] | null;
};

type DbRoomType = {
  id: string;
  name: string;
  description: string;
  max_occupancy: number;
  min_occupancy: number | null;
  max_children: number | null;
  category_id: string | null;
  bed_types: string[] | null;
  price: number | null;
  photos: string[] | null;
  main_photo_url: string | null;
  is_visible: boolean | null;
};

const fromDbFolioItem = (row: DbFolioItem): FolioItem => ({
  id: row.id,
  description: row.description,
  amount: Number(row.amount),
  timestamp: row.timestamp,
  paymentMethod: row.payment_method ?? undefined,
  transactionId: row.transaction_id ?? undefined,
  externalSource: row.external_source ?? undefined,
  externalReference: row.external_reference ?? undefined,
  externalMetadata: row.external_metadata ?? undefined,
});

const fromDbReservation = (row: DbReservation): Reservation => ({
  id: row.id,
  bookingId: row.booking_id,
  guestId: row.guest_id,
  roomId: row.room_id,
  ratePlanId: row.rate_plan_id,
  checkInDate: row.check_in_date,
  checkOutDate: row.check_out_date,
  numberOfGuests: row.number_of_guests,
  status: row.status,
  notes: row.notes ?? undefined,
  folio: (row.folio ?? []).map(fromDbFolioItem),
  totalAmount: row.total_amount,
  bookingDate: row.booking_date,
  source: row.source,
  paymentMethod: row.payment_method ?? "Not specified",
  adultCount: row.adult_count ?? row.number_of_guests,
  childCount: row.child_count ?? 0,
  taxEnabledSnapshot: Boolean(row.tax_enabled_snapshot),
  taxRateSnapshot: row.tax_rate_snapshot ?? 0,
  externalSource: row.external_source ?? undefined,
  externalId: row.external_id,
  externalMetadata: row.external_metadata ?? undefined,
});

const fromDbGuest = (row: DbGuest): Guest => ({
  id: row.id,
  firstName: row.first_name ?? "",
  lastName: row.last_name ?? "",
  email: row.email ?? "",
  phone: row.phone ?? "",
  address: row.address ?? undefined,
  pincode: row.pincode ?? undefined,
  city: row.city ?? undefined,
  state: row.state ?? undefined,
  country: row.country ?? undefined,
});

const fromDbRoom = (row: DbRoom): Room => ({
  id: row.id,
  roomNumber: row.room_number,
  roomTypeId: row.room_type_id,
  status: row.status,
  photos: row.photos ?? undefined,
});

const fromDbRoomType = (row: DbRoomType): RoomType => ({
  id: row.id,
  name: row.name,
  description: row.description,
  maxOccupancy: row.max_occupancy,
  minOccupancy: row.min_occupancy ?? undefined,
  maxChildren: row.max_children ?? undefined,
  categoryId: row.category_id ?? undefined,
  bedTypes: row.bed_types ?? [],
  price: row.price ?? 0,
  amenities: [],
  photos: row.photos ?? [],
  mainPhotoUrl: row.main_photo_url ?? undefined,
  isVisible: row.is_visible ?? true,
});

const throwIfError = (error: unknown, message: string) => {
  if (!error) {
    return;
  }

  if (error instanceof Error) {
    throw new BookingConfirmationError(error.message || message);
  }

  throw new BookingConfirmationError(message);
};

export async function getPublicBookingConfirmation(
  reservationId: string,
): Promise<PublicBookingConfirmation> {
  const supabase = createServerSupabaseClient();

  const reservationResponse = (await supabase
    .from("reservations")
    .select(PUBLIC_CONFIRMATION_RESERVATION_SELECT)
    .eq("id", reservationId)
    .limit(1)) as QueryResponse<DbReservation>;

  throwIfError(reservationResponse.error, "Failed to load reservation.");

  const reservationRow = reservationResponse.data?.[0];

  if (!reservationRow) {
    throw new BookingConfirmationError(
      "Reservation not found.",
      404,
      "RESERVATION_NOT_FOUND",
    );
  }

  const bookingReservationsResponse = (await supabase
    .from("reservations")
    .select(PUBLIC_CONFIRMATION_RESERVATION_SELECT)
    .eq("booking_id", reservationRow.booking_id)) as QueryResponse<DbReservation>;

  throwIfError(
    bookingReservationsResponse.error,
    "Failed to load booking reservations.",
  );

  const reservationRows = bookingReservationsResponse.data?.length
    ? bookingReservationsResponse.data
    : [reservationRow];
  const reservations = reservationRows.map(fromDbReservation);
  const reservation = fromDbReservation(reservationRow);

  const guestResponse = (await supabase
    .from("guests")
    .select(PUBLIC_CONFIRMATION_GUEST_SELECT)
    .eq("id", reservationRow.guest_id)
    .limit(1)) as QueryResponse<DbGuest>;

  throwIfError(guestResponse.error, "Failed to load guest.");

  const roomIds = Array.from(new Set(reservationRows.map((row) => row.room_id)));
  const roomsResponse = roomIds.length
    ? ((await supabase
      .from("rooms")
      .select(PUBLIC_CONFIRMATION_ROOM_SELECT)
      .in("id", roomIds)) as QueryResponse<DbRoom>)
    : { data: [], error: null };

  throwIfError(roomsResponse.error, "Failed to load booked rooms.");

  const rooms = (roomsResponse.data ?? []).map(fromDbRoom);
  const roomTypeIds = Array.from(new Set(rooms.map((room) => room.roomTypeId)));
  const roomTypesResponse = roomTypeIds.length
    ? ((await supabase
      .from("room_types")
      .select(PUBLIC_CONFIRMATION_ROOM_TYPE_SELECT)
      .in("id", roomTypeIds)) as QueryResponse<DbRoomType>)
    : { data: [], error: null };

  throwIfError(roomTypesResponse.error, "Failed to load booked room types.");

  return {
    reservation,
    bookingReservations: reservations,
    guest: guestResponse.data?.[0] ? fromDbGuest(guestResponse.data[0]) : null,
    rooms,
    roomTypes: (roomTypesResponse.data ?? []).map(fromDbRoomType),
  };
}

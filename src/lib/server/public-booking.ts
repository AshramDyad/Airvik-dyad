import "server-only";

import type {
  PropertyClosure,
  RatePlan,
  Reservation,
  ReservationStatus,
  Room,
  RoomType,
  SeasonalPrice,
} from "@/data/types";
import { createServerSupabaseClient } from "@/integrations/supabase/server";
import { BOOKABLE_ROOM_STATUSES } from "@/lib/rooms";
import { calculateRoomPricing } from "@/lib/pricing-calculator";
import { distributeGuestsAcrossRooms } from "@/lib/reservations/guest-allocation";

export const PUBLIC_BOOKING_PROPERTY_SELECT =
  "tax_enabled, tax_percentage" as const;
export const PUBLIC_BOOKING_ROOM_TYPE_SELECT =
  "id, name, description, max_occupancy, min_occupancy, max_children, category_id, bed_types, price, photos, main_photo_url, is_visible" as const;
export const PUBLIC_BOOKING_RATE_PLAN_SELECT =
  "id, name, price, rules" as const;
export const PUBLIC_BOOKING_SEASONAL_PRICE_SELECT =
  "id, room_type_id, name, price, start_date, end_date" as const;
export const PUBLIC_BOOKING_CLOSURE_SELECT =
  "id, property_id, room_type_id, start_date, end_date, reason" as const;
export const PUBLIC_BOOKING_ROOM_SELECT =
  "id, room_type_id, status" as const;
export const PUBLIC_BOOKING_CONFLICT_SELECT =
  "id, booking_id, room_id, check_in_date, check_out_date, status" as const;

export type PublicBookingInput = {
  roomTypeIds: string[];
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  specialRequests?: string;
  guest: {
    firstName: string;
    lastName: string;
    email?: string;
    phone: string;
    address: string;
    pincode?: string;
    city: string;
    state?: string;
    country?: string;
  };
};

export type PublicBookingResult = {
  confirmationReservationId: string;
  reservations: Reservation[];
};

export class PublicBookingError extends Error {
  readonly statusCode: number;
  readonly code: string;

  constructor(message: string, statusCode = 400, code = "PUBLIC_BOOKING_ERROR") {
    super(message);
    this.name = "PublicBookingError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

type DbPropertyTax = {
  tax_enabled: boolean | null;
  tax_percentage: number | null;
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

type DbRatePlan = {
  id: string;
  name: string;
  price: number | null;
  rules: RatePlan["rules"] | null;
};

type DbSeasonalPrice = {
  id: string;
  room_type_id: string;
  name: string;
  price: number;
  start_date: string;
  end_date: string;
};

type DbPropertyClosure = {
  id: string;
  property_id: string;
  room_type_id: string | null;
  start_date: string;
  end_date: string;
  reason: string | null;
};

type DbBookingRoom = {
  id: string;
  room_type_id: string;
  status: Room["status"];
};

type DbBookingConflict = {
  id: string;
  booking_id: string;
  room_id: string;
  check_in_date: string;
  check_out_date: string;
  status: ReservationStatus;
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

type QueryResponse<T> = {
  data: T[] | null;
  error: unknown;
};

type RpcResponse<T> = {
  data: T | null;
  error: unknown;
};

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

const fromDbRatePlan = (row: DbRatePlan): RatePlan => ({
  id: row.id,
  name: row.name,
  price: row.price ?? 0,
  rules: row.rules ?? {
    minStay: 1,
    cancellationPolicy: "",
  },
});

const fromDbSeasonalPrice = (row: DbSeasonalPrice): SeasonalPrice => ({
  id: row.id,
  roomTypeId: row.room_type_id,
  name: row.name,
  price: row.price,
  startDate: row.start_date,
  endDate: row.end_date,
});

const fromDbClosure = (row: DbPropertyClosure): PropertyClosure => ({
  id: row.id,
  propertyId: row.property_id,
  roomTypeId: row.room_type_id ?? undefined,
  startDate: row.start_date,
  endDate: row.end_date,
  reason: row.reason ?? undefined,
});

const fromDbRoom = (row: DbBookingRoom): Pick<Room, "id" | "roomTypeId" | "status"> => ({
  id: row.id,
  roomTypeId: row.room_type_id,
  status: row.status,
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
  folio: [],
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

const throwIfError = (error: unknown, message: string) => {
  if (!error) {
    return;
  }

  if (error instanceof Error) {
    throw new PublicBookingError(error.message || message, 500);
  }

  throw new PublicBookingError(message, 500);
};

const dateDiffInDays = (checkIn: string, checkOut: string) => {
  const start = Date.parse(`${checkIn}T00:00:00.000Z`);
  const end = Date.parse(`${checkOut}T00:00:00.000Z`);
  return Math.max(Math.round((end - start) / 86_400_000), 1);
};

const findSelectedRoomTypes = (
  roomTypes: RoomType[],
  roomTypeIds: string[],
): RoomType[] => {
  const roomTypesById = new Map(
    roomTypes
      .filter((roomType) => roomType.isVisible !== false)
      .map((roomType) => [roomType.id, roomType]),
  );

  return roomTypeIds.map((roomTypeId) => {
    const roomType = roomTypesById.get(roomTypeId);
    if (!roomType) {
      throw new PublicBookingError(
        "One or more selected rooms are no longer available.",
        409,
        "ROOM_TYPE_UNAVAILABLE",
      );
    }
    return roomType;
  });
};

const isClosureBlockingSelection = (
  closure: PropertyClosure,
  selectedRoomTypeIds: Set<string>,
) => !closure.roomTypeId || selectedRoomTypeIds.has(closure.roomTypeId);

export async function createPublicBooking(
  input: PublicBookingInput,
): Promise<PublicBookingResult> {
  const supabase = createServerSupabaseClient();
  const uniqueRoomTypeIds = Array.from(new Set(input.roomTypeIds));

  if (!uniqueRoomTypeIds.length) {
    throw new PublicBookingError("At least one room type is required.");
  }

  const [
    propertyResponse,
    roomTypesResponse,
    ratePlansResponse,
    seasonalPricesResponse,
    closuresResponse,
    roomsResponse,
  ] = await Promise.all([
    supabase
      .from("properties")
      .select(PUBLIC_BOOKING_PROPERTY_SELECT)
      .limit(1) as PromiseLike<QueryResponse<DbPropertyTax>>,
    supabase
      .from("room_types")
      .select(PUBLIC_BOOKING_ROOM_TYPE_SELECT)
      .in("id", uniqueRoomTypeIds) as PromiseLike<QueryResponse<DbRoomType>>,
    supabase
      .from("rate_plans")
      .select(PUBLIC_BOOKING_RATE_PLAN_SELECT) as PromiseLike<QueryResponse<DbRatePlan>>,
    supabase
      .from("seasonal_prices")
      .select(PUBLIC_BOOKING_SEASONAL_PRICE_SELECT)
      .in("room_type_id", uniqueRoomTypeIds)
      .lte("start_date", input.checkIn)
      .gte("end_date", input.checkIn) as PromiseLike<QueryResponse<DbSeasonalPrice>>,
    supabase
      .from("property_closures")
      .select(PUBLIC_BOOKING_CLOSURE_SELECT)
      .lt("start_date", input.checkOut)
      .gte("end_date", input.checkIn) as PromiseLike<QueryResponse<DbPropertyClosure>>,
    supabase
      .from("rooms")
      .select(PUBLIC_BOOKING_ROOM_SELECT)
      .in("room_type_id", uniqueRoomTypeIds)
      .in("status", BOOKABLE_ROOM_STATUSES) as PromiseLike<QueryResponse<DbBookingRoom>>,
  ]);

  throwIfError(propertyResponse.error, "Failed to load property settings.");
  throwIfError(roomTypesResponse.error, "Failed to load selected room types.");
  throwIfError(ratePlansResponse.error, "Failed to load rate plans.");
  throwIfError(seasonalPricesResponse.error, "Failed to load seasonal prices.");
  throwIfError(closuresResponse.error, "Failed to load property closures.");
  throwIfError(roomsResponse.error, "Failed to load room inventory.");

  const propertyTax = propertyResponse.data?.[0] ?? {
    tax_enabled: false,
    tax_percentage: 0,
  };
  const roomTypes = (roomTypesResponse.data ?? []).map(fromDbRoomType);
  const selectedRoomTypes = findSelectedRoomTypes(
    roomTypes,
    input.roomTypeIds,
  );
  const selectedRoomTypeIdSet = new Set(uniqueRoomTypeIds);
  const blockingClosure = (closuresResponse.data ?? [])
    .map(fromDbClosure)
    .find((closure) =>
      isClosureBlockingSelection(closure, selectedRoomTypeIdSet),
    );

  if (blockingClosure) {
    throw new PublicBookingError(
      blockingClosure.reason ||
        "The property is closed for your selected dates. Please choose different dates.",
      409,
      "PROPERTY_CLOSED",
    );
  }

  const ratePlans = (ratePlansResponse.data ?? []).map(fromDbRatePlan);
  const ratePlan =
    ratePlans.find((candidate) => candidate.name === "Standard Rate") ??
    ratePlans[0];

  if (!ratePlan) {
    throw new PublicBookingError(
      "Rate information is unavailable. Please contact us directly to complete your booking.",
      409,
      "RATE_PLAN_UNAVAILABLE",
    );
  }

  const rooms = (roomsResponse.data ?? []).map(fromDbRoom);
  const candidateRoomIds = rooms.map((room) => room.id);
  let conflicts: DbBookingConflict[] = [];

  if (candidateRoomIds.length > 0) {
    const conflictsResponse = (await supabase
      .from("reservations")
      .select(PUBLIC_BOOKING_CONFLICT_SELECT)
      .in("room_id", candidateRoomIds)
      .neq("status", "Cancelled")
      .neq("status", "No-show")
      .lt("check_in_date", input.checkOut)
      .gt("check_out_date", input.checkIn)) as QueryResponse<DbBookingConflict>;

    throwIfError(conflictsResponse.error, "Failed to load reservation conflicts.");
    conflicts = conflictsResponse.data ?? [];
  }

  const conflictingRoomIds = new Set(conflicts.map((conflict) => conflict.room_id));
  const occupancyTargets = distributeGuestsAcrossRooms(
    input.adults,
    input.children,
    selectedRoomTypes.length,
  );
  const assignedRoomIds: string[] = [];

  for (const [index, roomType] of selectedRoomTypes.entries()) {
    const candidates = rooms.filter(
      (room) =>
        room.roomTypeId === roomType.id &&
        !assignedRoomIds.includes(room.id) &&
        !conflictingRoomIds.has(room.id),
    );

    let assignedRoomId: string | null = null;

    for (const room of candidates) {
      const occupancy = occupancyTargets[index] ?? { adults: 1, children: 0 };
      const validationResponse = (await supabase.rpc("validate_booking_request", {
        p_check_in: input.checkIn,
        p_check_out: input.checkOut,
        p_room_id: room.id,
        p_adults: occupancy.adults,
        p_children: occupancy.children,
      })) as RpcResponse<{ isValid?: boolean; message?: string }>;

      throwIfError(validationResponse.error, "Failed to validate booking request.");

      if (validationResponse.data?.isValid !== false) {
        assignedRoomId = room.id;
        break;
      }
    }

    if (!assignedRoomId) {
      throw new PublicBookingError(
        "One or more rooms are no longer available for your selected dates.",
        409,
        "ROOM_UNAVAILABLE",
      );
    }

    assignedRoomIds.push(assignedRoomId);
  }

  const guestResponse = (await supabase.rpc("get_or_create_booking_guest", {
    p_first_name: input.guest.firstName,
    p_last_name: input.guest.lastName,
    p_email: input.guest.email ?? "",
    p_phone: input.guest.phone,
    p_address: input.guest.address,
    p_pincode: input.guest.pincode,
    p_city: input.guest.city,
    p_state: input.guest.state,
    p_country: input.guest.country,
  })) as RpcResponse<{ id: string }>;

  throwIfError(guestResponse.error, "Could not get or create guest record.");

  if (!guestResponse.data?.id) {
    throw new PublicBookingError("Could not get or create guest record.", 500);
  }

  const seasonalPrices = (seasonalPricesResponse.data ?? []).map(
    fromDbSeasonalPrice,
  );
  const nights = dateDiffInDays(input.checkIn, input.checkOut);
  const customRoomTotals = selectedRoomTypes.map((roomType) =>
    calculateRoomPricing({
      roomType,
      ratePlan,
      nights,
      rooms: 1,
      seasonalPrices,
      checkInDate: input.checkIn,
    }).totalCost,
  );

  const reservationsResponse = (await supabase.rpc(
    "create_reservations_with_total",
    {
      p_booking_id: "",
      p_guest_id: guestResponse.data.id,
      p_room_ids: assignedRoomIds,
      p_rate_plan_id: ratePlan.id,
      p_check_in_date: input.checkIn,
      p_check_out_date: input.checkOut,
      p_number_of_guests: input.adults + input.children,
      p_status: "Confirmed",
      p_notes: input.specialRequests?.trim() || null,
      p_booking_date: new Date().toISOString(),
      p_source: "website",
      p_payment_method: "UPI",
      p_adult_count: input.adults,
      p_child_count: input.children,
      p_tax_enabled_snapshot: Boolean(propertyTax.tax_enabled),
      p_tax_rate_snapshot: propertyTax.tax_percentage ?? 0,
      p_custom_totals: customRoomTotals,
    },
  )) as RpcResponse<DbReservation[]>;

  throwIfError(reservationsResponse.error, "Could not create reservation.");

  const reservations = (reservationsResponse.data ?? []).map(fromDbReservation);
  const confirmationReservationId = reservations[0]?.id;

  if (!confirmationReservationId) {
    throw new PublicBookingError("Could not create reservation.", 500);
  }

  return {
    confirmationReservationId,
    reservations,
  };
}

import type {
  Amenity,
  FolioItem,
  Guest,
  Property,
  RatePlan,
  Reservation,
  Role,
  Room,
  RoomStatus,
  RoomType,
  SeasonalPrice,
  StickyNote,
  User,
} from "@/data/types";
import { allPermissions } from "@/data/types";
import type { DbReservation } from "@/lib/reservations/reservation-mappers";
import type { Session } from "@supabase/supabase-js";

let roleSequence = 1;
let userSequence = 1;
let propertySequence = 1;
let ratePlanSequence = 1;
let roomTypeSequence = 1;
let roomSequence = 1;
let seasonalPriceSequence = 1;
let reservationSequence = 1;
let guestSequence = 1;
let folioSequence = 1;
let stickyNoteSequence = 1;

export const resetBuilderSequences = () => {
  roleSequence = 1;
  userSequence = 1;
  propertySequence = 1;
  ratePlanSequence = 1;
  roomTypeSequence = 1;
  roomSequence = 1;
  seasonalPriceSequence = 1;
  reservationSequence = 1;
  guestSequence = 1;
  folioSequence = 1;
  stickyNoteSequence = 1;
};

export const buildRole = (overrides: Partial<Role> = {}): Role => {
  const base: Role = {
    id: overrides.id ?? `role-${roleSequence}`,
    name: overrides.name ?? `Role ${roleSequence}`,
    permissions:
      overrides.permissions ??
      allPermissions.slice(0, Math.max(1, (roleSequence % allPermissions.length) || 3)),
    hierarchyLevel: overrides.hierarchyLevel ?? roleSequence,
  };

  roleSequence += 1;

  return { ...base, ...overrides };
};

export const buildUser = (overrides: Partial<User> = {}): User => {
  const base: User = {
    id: overrides.id ?? `user-${userSequence}`,
    name: overrides.name ?? `User ${userSequence}`,
    email: overrides.email ?? `user${userSequence}@example.com`,
    roleId: overrides.roleId ?? buildRole().id,
    avatarUrl: overrides.avatarUrl,
  };

  userSequence += 1;

  return { ...base, ...overrides };
};

export const buildAmenity = (overrides: Partial<Amenity> = {}): Amenity => {
  const base: Amenity = {
    id: overrides.id ?? `amenity-${propertySequence}`,
    name: overrides.name ?? `Amenity ${propertySequence}`,
    icon: overrides.icon ?? "sparkles",
  };

  propertySequence += 1;

  return { ...base, ...overrides };
};

export const buildSession = (user: User = buildUser()): Session => ({
  access_token: "test-token", refresh_token: "test-refresh", expires_in: 3600, token_type: "bearer",
  user: { id: user.id, email: user.email, aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {}, created_at: "2026-10-01T00:00:00.000Z" },
});

export const buildProperty = (): Property => {
  const property: Property = {
    id: `property-${propertySequence}`,
    name: `Hotel ${propertySequence}`,
    address: "123 Ocean Drive",
    phone: "+1-555-1200",
    email: "info@example.com",
    logo_url: "https://example.com/logo.png",
    photos: ["https://example.com/property.jpg"],
    google_maps_url: "https://maps.example.com/property",
    timezone: "America/New_York",
    currency: "USD",
    allowSameDayTurnover: true,
    showPartialDays: true,
    defaultUnitsView: "remaining",
    tax_enabled: false,
    tax_percentage: 0,
  };

  propertySequence += 1;

  return property;
};

export const buildRatePlan = (overrides: Partial<RatePlan> = {}): RatePlan => {
  const base: RatePlan = {
    id: overrides.id ?? `rate-plan-${ratePlanSequence}`,
    name: overrides.name ?? `Rate Plan ${ratePlanSequence}`,
    price: overrides.price ?? 3000,
    rules: overrides.rules ?? {
      minStay: 1,
      cancellationPolicy: "Free cancellation up to 24 hours before check-in",
    },
  };

  ratePlanSequence += 1;

  return { ...base, ...overrides };
};

export const buildRoomType = (overrides: Partial<RoomType> = {}): RoomType => {
  const base: RoomType = {
    id: overrides.id ?? `room-type-${roomTypeSequence}`,
    name: overrides.name ?? `Room Type ${roomTypeSequence}`,
    description: overrides.description ?? "Spacious suite with city view",
    maxOccupancy: overrides.maxOccupancy ?? 2,
    bedTypes: overrides.bedTypes ?? ["King"],
    price: overrides.price ?? 2500,
    amenities: overrides.amenities ?? [buildAmenity().id],
    photos: overrides.photos ?? [
      `https://example.com/rooms/${roomTypeSequence}.jpg`,
    ],
    mainPhotoUrl: overrides.mainPhotoUrl,
    isVisible: overrides.isVisible ?? true,
  };

  roomTypeSequence += 1;

  return { ...base, ...overrides };
};

export const buildRoom = (overrides: Partial<Room> = {}): Room => {
  const base: Room = {
    id: overrides.id ?? `room-${roomSequence}`,
    roomNumber: overrides.roomNumber ?? `${100 + roomSequence}`,
    roomTypeId: overrides.roomTypeId ?? buildRoomType().id,
    status: overrides.status ?? ("Clean" as RoomStatus),
    photos: overrides.photos ?? [],
  };

  roomSequence += 1;

  return { ...base, ...overrides };
};

export const buildSeasonalPrice = (
  overrides: Partial<SeasonalPrice> = {}
): SeasonalPrice => {
  const base: SeasonalPrice = {
    id: overrides.id ?? `seasonal-price-${seasonalPriceSequence}`,
    roomTypeId: overrides.roomTypeId ?? buildRoomType().id,
    name: overrides.name ?? `Season ${seasonalPriceSequence}`,
    price: overrides.price ?? 3500,
    startDate: overrides.startDate ?? "2026-04-01",
    endDate: overrides.endDate ?? "2026-06-30",
  };

  seasonalPriceSequence += 1;

  return { ...base, ...overrides };
};

export const buildGuest = (overrides: Partial<Guest> = {}): Guest => {
  const base: Guest = {
    id: overrides.id ?? `guest-${guestSequence}`,
    firstName: overrides.firstName ?? "Alex",
    lastName: overrides.lastName ?? `Guest${guestSequence}`,
    email: overrides.email ?? `guest${guestSequence}@example.com`,
    phone: overrides.phone ?? "+1-555-0100",
    avatarUrl: overrides.avatarUrl,
  };

  guestSequence += 1;

  return { ...base, ...overrides };
};

export const buildFolioItem = (overrides: Partial<FolioItem> = {}): FolioItem => {
  const base: FolioItem = {
    id: overrides.id ?? `folio-${folioSequence}`,
    description: overrides.description ?? "Accommodation",
    amount: overrides.amount ?? 199.99,
    timestamp:
      overrides.timestamp ?? new Date().toISOString(),
  };

  folioSequence += 1;

  return { ...base, ...overrides };
};

export const buildReservation = (
  overrides: Partial<Reservation> = {}
): Reservation => {
  const guest = overrides.guestId ? undefined : buildGuest();
  const room = overrides.roomId ? undefined : buildRoom();

  const base: Reservation = {
    id: overrides.id ?? `reservation-${reservationSequence}`,
    bookingId: overrides.bookingId ?? `booking-${reservationSequence}`,
    guestId: overrides.guestId ?? guest?.id ?? "guest-1",
    roomId: overrides.roomId ?? room?.id ?? "room-1",
    ratePlanId: overrides.ratePlanId ?? "rate-plan-standard",
    checkInDate:
      overrides.checkInDate ?? new Date().toISOString().split("T")[0],
    checkOutDate:
      overrides.checkOutDate ??
      new Date(Date.now() + 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0],
    numberOfGuests: overrides.numberOfGuests ?? 2,
    status: overrides.status ?? "Confirmed",
    notes: overrides.notes,
    folio: overrides.folio ?? [buildFolioItem()],
    totalAmount: overrides.totalAmount ?? 249.99,
    bookingDate:
      overrides.bookingDate ?? new Date().toISOString().split("T")[0],
    source: overrides.source ?? "reception",
    paymentMethod: overrides.paymentMethod ?? "Not specified",
    adultCount: overrides.adultCount ?? overrides.numberOfGuests ?? 2,
    childCount: overrides.childCount ?? 0,
    taxEnabledSnapshot: overrides.taxEnabledSnapshot ?? false,
    taxRateSnapshot: overrides.taxRateSnapshot ?? 0,
  };

  reservationSequence += 1;

  return { ...base, ...overrides };
};

export const buildDbReservation = (
  reservation: Reservation = buildReservation(),
  overrides: Partial<DbReservation> = {}
): DbReservation => ({
  id: reservation.id,
  booking_id: reservation.bookingId,
  guest_id: reservation.guestId,
  room_id: reservation.roomId,
  rate_plan_id: reservation.ratePlanId,
  check_in_date: reservation.checkInDate,
  check_out_date: reservation.checkOutDate,
  number_of_guests: reservation.numberOfGuests,
  status: reservation.status,
  notes: reservation.notes ?? null,
  total_amount: reservation.totalAmount,
  booking_date: reservation.bookingDate,
  source: reservation.source,
  payment_method: reservation.paymentMethod,
  adult_count: reservation.adultCount,
  child_count: reservation.childCount,
  hold_expires_at: reservation.holdExpiresAt ?? null,
  tax_enabled_snapshot: reservation.taxEnabledSnapshot ?? false,
  tax_rate_snapshot: reservation.taxRateSnapshot ?? 0,
  external_source: reservation.externalSource ?? "internal",
  external_id: reservation.externalId ?? null,
  external_metadata: reservation.externalMetadata ?? {},
  guest: reservation.guestSnapshot ? {
    first_name: reservation.guestSnapshot.firstName ?? null,
    last_name: reservation.guestSnapshot.lastName ?? null,
    email: reservation.guestSnapshot.email ?? null,
    phone: reservation.guestSnapshot.phone ?? null,
  } : null,
  folio: reservation.folio.map((item) => ({
    id: item.id, reservation_id: reservation.id, description: item.description, amount: item.amount,
    timestamp: item.timestamp, payment_method: item.paymentMethod ?? null, transaction_id: item.transactionId ?? null,
    external_source: item.externalSource ?? "internal", external_reference: item.externalReference ?? null,
    external_metadata: item.externalMetadata ?? {}, received_by: item.receivedBy ?? null, received_at: item.receivedAt ?? null,
  })),
  ...overrides,
});

export const buildStickyNote = (overrides: Partial<StickyNote> = {}): StickyNote => {
  const colors: Array<'yellow' | 'pink' | 'blue' | 'green'> = ['yellow', 'pink', 'blue', 'green'];
  const color = colors[(stickyNoteSequence - 1) % colors.length];

  const base: StickyNote = {
    id: overrides.id ?? `sticky-note-${stickyNoteSequence}`,
    title: overrides.title ?? `Note ${stickyNoteSequence}`,
    description: overrides.description,
    color: overrides.color ?? color,
    createdAt: overrides.createdAt ?? new Date().toISOString(),
  };

  stickyNoteSequence += 1;

  return { ...base, ...overrides };
};

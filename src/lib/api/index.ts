import { supabase } from "@/integrations/supabase/client";
import type { PostgrestError } from "@supabase/supabase-js";
import type {
  Property,
  Guest,
  Reservation,
  Room,
  RoomType,
  RoomCategory,
  RatePlan,
  SeasonalPrice,
  Role,
  Amenity,
  StickyNote,
  FolioItem,
  ReservationStatus,
  Category,
  Post,
  BookingRestriction,
  PropertyClosure,
  AdminActivityLog,
  ActivitySection,
  ActivityEntityType,
  AdminActivityLogPayload,
} from "@/data/types";
import {
  DbCategory,
  DbPost,
  DbPostUpdatePayload,
  DbPostWithCategories,
  fromDbCategory,
  fromDbPost,
  fromDbPostWithCategories,
} from "@/lib/api/blog-mappers";

const INTERNAL_FOLIO_SOURCE = "internal" as const;

// Column selection constants to reduce egress
export const PROPERTY_SELECT_COLUMNS =
  "id, name, address, phone, email, logo_url, photos, google_maps_url, timezone, currency, allowSameDayTurnover:allow_same_day_turnover, showPartialDays:show_partial_days, defaultUnitsView:default_units_view, tax_enabled, tax_percentage, trust_registration_no, trust_date, pan_no, certificate_no" as const;
export const PROPERTY_CREATE_RETURN_COLUMNS =
  "id, allowSameDayTurnover:allow_same_day_turnover, showPartialDays:show_partial_days, defaultUnitsView:default_units_view" as const;
const GUEST_SELECT_COLUMNS = 'id, first_name, last_name, email, phone, address, pincode, city, state, country, created_at' as const;
const ROOM_SELECT_COLUMNS = 'id, room_number, room_type_id, status, photos' as const;
export const ROOM_TYPE_SELECT_COLUMNS =
  "id, name, description, max_occupancy, min_occupancy, max_children, category_id, bed_types, price, photos, main_photo_url, is_visible" as const;
export const ROOM_CATEGORY_SELECT_COLUMNS = "id, name, description" as const;
export const RATE_PLAN_SELECT_COLUMNS = "id, name, price, rules" as const;
export const AMENITY_SELECT_COLUMNS = "id, name, icon" as const;
export const ROOM_TYPE_AMENITY_SELECT_COLUMNS = "room_type_id, amenity_id" as const;
export const ROOM_TYPE_WITH_AMENITIES_SELECT_COLUMNS =
  `${ROOM_TYPE_SELECT_COLUMNS}, room_type_amenities(amenity_id)` as const;
export const SEASONAL_PRICE_SELECT_COLUMNS =
  "id, room_type_id, name, price, start_date, end_date" as const;
export const ROLE_SELECT_COLUMNS = "id, name, permissions, hierarchy_level" as const;
export const USER_PROFILE_SELECT_COLUMNS =
  `id, name, role_id, roles:roles(${ROLE_SELECT_COLUMNS})` as const;
export const PROFILE_SELECT_COLUMNS = "id, name, role_id" as const;
export const STICKY_NOTE_SELECT_COLUMNS =
  "id, title, description, color, createdAt:created_at" as const;
export const HOUSEKEEPING_ASSIGNMENT_SELECT_COLUMNS =
  "roomId:room_id, assignedTo:assigned_to, date, status" as const;
export const BOOKING_RESTRICTION_SELECT_COLUMNS =
  "id, name, restriction_type, value, start_date, end_date, room_type_id, created_at, updated_at" as const;
export const PROPERTY_CLOSURE_SELECT_COLUMNS =
  "id, property_id, room_type_id, start_date, end_date, reason" as const;
export const ADMIN_ACTIVITY_LOG_SELECT_COLUMNS =
  "id, actor_user_id, actor_role, actor_name, section, entity_type, entity_id, entity_label, action, details, amount_minor, metadata, created_at" as const;
export const CATEGORY_SELECT_COLUMNS =
  "id, name, slug, description, parent_id, created_at" as const;
export const POST_SELECT_COLUMNS =
  "id, title, slug, content, excerpt, featured_image, status, published_at, author_id, created_at, updated_at" as const;
export const FOLIO_ITEM_SELECT_COLUMNS =
  "id, reservation_id, description, amount, timestamp, payment_method, transaction_id, external_source, external_reference, external_metadata" as const;
export const RESERVATION_SELECT_COLUMNS =
  `id, booking_id, guest_id, room_id, rate_plan_id, check_in_date, check_out_date, number_of_guests, status, notes, total_amount, booking_date, source, payment_method, adult_count, child_count, tax_enabled_snapshot, tax_rate_snapshot, external_source, external_id, external_metadata, guest:guests(first_name,last_name,email,phone), folio:folio_items(${FOLIO_ITEM_SELECT_COLUMNS})` as const;
export const RESERVATION_CREATE_RETURN_COLUMNS =
  "id, booking_id, room_id, total_amount, booking_date" as const;

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

type DbCategoryUpdatePayload = Partial<
  Pick<DbCategory, "name" | "slug" | "description" | "parent_id">
>;

type DbCategoryIdRow = Pick<DbCategory, "id">;

type DbCategoryInsertPayload = Pick<
  DbCategory,
  "name" | "slug" | "description" | "parent_id"
>;

type DbPostIdRow = Pick<DbPost, "id">;

type DbPostInsertPayload = Pick<
  DbPost,
  | "title"
  | "slug"
  | "content"
  | "excerpt"
  | "featured_image"
  | "status"
  | "published_at"
  | "author_id"
>;

type GuestUpdatePayload = Partial<
  Pick<DbGuest, "first_name" | "last_name" | "email" | "phone" | "address" | "pincode" | "city" | "state" | "country">
>;

type GetOrCreateGuestArgs = {
  firstName: string;
  lastName: string;
  email?: string;
  phone: string;
  address?: string;
  pincode?: string;
  city?: string;
  state?: string;
  country?: string;
};

type DbRoom = {
  id: string;
  room_number: string;
  room_type_id: string;
  status: Room["status"];
  photos: string[] | null;
};

type RoomUpdatePayload = Partial<
  Pick<DbRoom, "room_number" | "room_type_id" | "status" | "photos">
>;

type DbRoomType = {
  id: string;
  name: string;
  description: string;
  max_occupancy: number;
  min_occupancy?: number | null;
  max_children?: number | null;
  category_id?: string | null;
  bed_types: string[];
  price: number | null;
  amenities?: string[] | null;
  photos?: string[] | null;
  main_photo_url?: string | null;
  is_visible: boolean | null;
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
  notes?: string | null;
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
  guest?: DbReservationGuest | null;
};

type DbReservationCreateReturnRow = Pick<
  DbReservation,
  "id" | "booking_id" | "room_id" | "total_amount" | "booking_date"
>;

type DbReservationGuest = {
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
};

type ReservationUpdatePayload = Partial<
  Pick<
    DbReservation,
    | "booking_id"
    | "guest_id"
    | "room_id"
    | "rate_plan_id"
    | "check_in_date"
    | "check_out_date"
    | "number_of_guests"
    | "status"
    | "notes"
    | "folio"
    | "total_amount"
    | "booking_date"
    | "source"
    | "payment_method"
    | "adult_count"
    | "child_count"
    | "tax_enabled_snapshot"
    | "tax_rate_snapshot"
    | "external_source"
    | "external_id"
    | "external_metadata"
  >
>;

type DbReservationInsert = ReservationUpdatePayload & {
  booking_id: string;
  guest_id: string;
  room_id: string;
  rate_plan_id: string;
  check_in_date: string;
  check_out_date: string;
  number_of_guests: number;
  status: ReservationStatus;
  total_amount: number;
  booking_date: string;
  source: Reservation["source"];
  payment_method: Reservation["paymentMethod"];
  adult_count: number;
  child_count: number;
  tax_enabled_snapshot: boolean;
  tax_rate_snapshot: number;
};

type DbBookingRestriction = {
  id: string;
  name: string | null;
  restriction_type: BookingRestriction["restrictionType"];
  value: BookingRestriction["value"];
  start_date: string | null;
  end_date: string | null;
  room_type_id: string | null;
  created_at: string;
  updated_at: string;
};

type CreateReservationsArgs = {
  p_booking_id?: string | null;   // optional - allow DB to generate when null/omitted
  p_guest_id: string;             // uuid - validate UUID format
  p_room_ids: string[];           // uuid[] - validate UUID format
  p_rate_plan_id: string;         // uuid - validate UUID format
  p_check_in_date: string;        // date - convert to YYYY-MM-DD
  p_check_out_date: string;       // date - convert to YYYY-MM-DD
  p_number_of_guests: number;
  p_status: ReservationStatus;
  p_notes?: string | null;
  p_booking_date?: string | null; // timestamptz - convert to ISO 8601
  p_source?: Reservation["source"] | null;
  p_payment_method?: Reservation["paymentMethod"] | null;
  p_adult_count?: number | null;
  p_child_count?: number | null;
  p_tax_enabled_snapshot?: boolean | null;
  p_tax_rate_snapshot?: number | null;
  p_custom_totals?: Array<number | null> | null;
};

type RoomTypeAmenityRow = {
  amenity_id: string;
  room_type_id: string;
};

type RoomTypeUpsertInput = Omit<RoomType, "id"> & {
  id?: string;
};

type FolioItemInsertPayload = {
  reservation_id: string;
  description: string;
  amount: number;
  payment_method?: string | null;
  transaction_id?: string | null;
  timestamp?: string;
  external_source?: string | null;
  external_reference?: string | null;
  external_metadata?: Record<string, unknown> | null;
};

type StickyNoteInsertPayload = Omit<StickyNote, "id" | "createdAt"> & {
  user_id: string;
};

type RoomTypeWithAmenitiesRow = DbRoomType & {
  room_type_amenities: RoomTypeAmenityRow[] | null;
};

type UpdateUserProfilePayload = Partial<{
  name: string;
  roleId: string;
}>;

const toDbUserProfilePayload = (
  updatedData: UpdateUserProfilePayload
): Record<string, unknown> => {
  const payload: Record<string, unknown> = {};
  if (typeof updatedData.name !== "undefined") {
    payload.name = updatedData.name;
  }
  if (typeof updatedData.roleId !== "undefined") {
    payload.role_id = updatedData.roleId;
  }
  return payload;
};

const toDbRolePayload = (roleData: Partial<Role>): Record<string, unknown> => {
  const payload: Record<string, unknown> = {};
  if (typeof roleData.name !== "undefined") {
    payload.name = roleData.name;
  }
  if (typeof roleData.permissions !== "undefined") {
    payload.permissions = roleData.permissions;
  }
  if (typeof (roleData as Partial<Role>).hierarchyLevel !== "undefined") {
    payload.hierarchy_level = (roleData as Partial<Role>).hierarchyLevel;
  }
  return payload;
};

type DbAdminActivityLog = {
  id: string;
  actor_user_id: string | null;
  actor_role: string;
  actor_name: string | null;
  section: string;
  entity_type: string | null;
  entity_id: string | null;
  entity_label: string | null;
  action: string;
  details: string | null;
  amount_minor: number | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

type AdminActivityLogFilters = {
  section?: ActivitySection;
  entityType?: ActivityEntityType;
  entityId?: string;
  actorRole?: string;
  action?: string;
  from?: string;
  to?: string;
  limit?: number;
  page?: number;
};


const normalizeBookingCodeInput = (bookingId?: string | null): string | null => {
  if (typeof bookingId !== "string") {
    return null;
  }
  const trimmed = bookingId.trim();
  if (!trimmed) {
    return null;
  }

  const upper = trimmed.toUpperCase();
  return /^A[0-9]+$/.test(upper) ? upper : null;
};


// --- Validation Helpers ---

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const validateUUID = (value: string, fieldName: string): void => {
  if (!UUID_REGEX.test(value)) {
    throw new Error(`Invalid UUID format for ${fieldName}: ${value}`);
  }
};

const formatDateForPostgres = (dateStr: string): string => {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid date: ${dateStr}`);
  }
  return date.toISOString().split('T')[0]; // YYYY-MM-DD
};

const formatTimestampForPostgres = (dateStr: string): string => {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid timestamp: ${dateStr}`);
  }
  return date.toISOString(); // Full ISO 8601 with timezone
};

// --- Data Transformation Helpers ---

const fromDbGuest = (dbGuest: DbGuest): Guest => ({
  id: dbGuest.id,
  firstName: dbGuest.first_name ?? "",
  lastName: dbGuest.last_name ?? "",
  email: dbGuest.email ?? "",
  phone: dbGuest.phone ?? "",
  address: dbGuest.address ?? "",
  pincode: dbGuest.pincode ?? "",
  city: dbGuest.city ?? "",
  state: dbGuest.state ?? "",
  country: dbGuest.country ?? "",
});

const toDbGuest = (appGuest: Partial<Omit<Guest, "id">>): GuestUpdatePayload => {
  const normalizeNullableText = (value: string): string | null => {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  };

  const dbData: GuestUpdatePayload = {};

  if (typeof appGuest.firstName === "string" && appGuest.firstName.trim().length > 0) {
    dbData.first_name = appGuest.firstName.trim();
  }
  if (typeof appGuest.lastName === "string" && appGuest.lastName.trim().length > 0) {
    dbData.last_name = appGuest.lastName.trim();
  }

  if (typeof appGuest.email === "string") {
    dbData.email = normalizeNullableText(appGuest.email);
  }
  if (typeof appGuest.phone === "string") {
    dbData.phone = normalizeNullableText(appGuest.phone);
  }
  if (typeof appGuest.address === "string") {
    dbData.address = normalizeNullableText(appGuest.address);
  }
  if (typeof appGuest.pincode === "string") {
    dbData.pincode = normalizeNullableText(appGuest.pincode);
  }
  if (typeof appGuest.city === "string") {
    dbData.city = normalizeNullableText(appGuest.city);
  }
  if (typeof appGuest.state === "string") {
    dbData.state = normalizeNullableText(appGuest.state);
  }
  if (typeof appGuest.country === "string") {
    dbData.country = normalizeNullableText(appGuest.country);
  }

  return dbData;
};

const fromDbRoom = (dbRoom: DbRoom): Room => ({
  id: dbRoom.id,
  roomNumber: dbRoom.room_number,
  roomTypeId: dbRoom.room_type_id,
  status: dbRoom.status,
  photos: dbRoom.photos ?? undefined,
});

const toDbRoom = (appRoom: Partial<Omit<Room, "id">>): RoomUpdatePayload => {
  const dbData: RoomUpdatePayload = {};
  if (appRoom.roomNumber) dbData.room_number = appRoom.roomNumber;
  if (appRoom.roomTypeId) dbData.room_type_id = appRoom.roomTypeId;
  if (appRoom.status) dbData.status = appRoom.status;
  if (appRoom.photos) dbData.photos = appRoom.photos;
  return dbData;
};

export const fromDbRoomType = (dbRoomType: DbRoomType): RoomType => ({
  id: dbRoomType.id,
  name: dbRoomType.name,
  description: dbRoomType.description,
  maxOccupancy: dbRoomType.max_occupancy,
  minOccupancy: dbRoomType.min_occupancy ?? undefined,
  maxChildren: dbRoomType.max_children ?? undefined,
  categoryId: dbRoomType.category_id ?? undefined,
  bedTypes: dbRoomType.bed_types,
  price: dbRoomType.price ?? 0,
  amenities: dbRoomType.amenities ?? [],
  photos: dbRoomType.photos ?? [],
  mainPhotoUrl: dbRoomType.main_photo_url ?? undefined,
  isVisible: dbRoomType.is_visible ?? true,
});

const fromDbFolioItem = (dbFolio: DbFolioItem): FolioItem => ({
  id: dbFolio.id,
  description: dbFolio.description,
  amount: Number(dbFolio.amount),
  timestamp: dbFolio.timestamp,
  paymentMethod: dbFolio.payment_method ?? undefined,
  transactionId: dbFolio.transaction_id ?? undefined,
  externalSource: dbFolio.external_source ?? undefined,
  externalReference: dbFolio.external_reference ?? undefined,
  externalMetadata: dbFolio.external_metadata ?? undefined,
});

const fromDbReservation = (dbReservation: DbReservation): Reservation => ({
  id: dbReservation.id,
  bookingId: dbReservation.booking_id,
  guestId: dbReservation.guest_id,
  roomId: dbReservation.room_id,
  ratePlanId: dbReservation.rate_plan_id ?? null,
  checkInDate: dbReservation.check_in_date,
  checkOutDate: dbReservation.check_out_date,
  numberOfGuests: dbReservation.number_of_guests,
  status: dbReservation.status,
  notes: dbReservation.notes ?? undefined,
  folio: (dbReservation.folio as DbFolioItem[])?.map(fromDbFolioItem) ?? [],
  totalAmount: dbReservation.total_amount,
  bookingDate: dbReservation.booking_date,
  source: dbReservation.source,
  paymentMethod: dbReservation.payment_method ?? "Not specified",
  adultCount:
    typeof dbReservation.adult_count === "number"
      ? dbReservation.adult_count
      : dbReservation.number_of_guests,
  childCount:
    typeof dbReservation.child_count === "number"
      ? dbReservation.child_count
      : 0,
  taxEnabledSnapshot: Boolean(dbReservation.tax_enabled_snapshot ?? false),
  taxRateSnapshot: dbReservation.tax_rate_snapshot ?? 0,
  externalSource: dbReservation.external_source ?? undefined,
  externalId: dbReservation.external_id,
  externalMetadata: dbReservation.external_metadata ?? undefined,
  guestSnapshot: dbReservation.guest
    ? {
      firstName: dbReservation.guest.first_name,
      lastName: dbReservation.guest.last_name,
      email: dbReservation.guest.email,
      phone: dbReservation.guest.phone,
    }
    : undefined,
});

const toDbFolioItem = (folioItem: FolioItem, reservationId?: string): DbFolioItem => ({
  id: folioItem.id,
  reservation_id: reservationId || "",
  description: folioItem.description,
  amount: folioItem.amount,
  timestamp: folioItem.timestamp,
  payment_method: folioItem.paymentMethod ?? null,
  transaction_id: folioItem.transactionId ?? null,
  external_source: folioItem.externalSource ?? null,
  external_reference: folioItem.externalReference ?? null,
  external_metadata: folioItem.externalMetadata ?? null,
});

const toDbReservation = (
  appReservation: Partial<Reservation>
): ReservationUpdatePayload => {
  const dbData: ReservationUpdatePayload = {};
  if (appReservation.bookingId) dbData.booking_id = appReservation.bookingId;
  if (appReservation.guestId) dbData.guest_id = appReservation.guestId;
  if (appReservation.roomId) dbData.room_id = appReservation.roomId;
  if (typeof appReservation.ratePlanId !== "undefined") {
    dbData.rate_plan_id = appReservation.ratePlanId;
  }
  if (appReservation.checkInDate) dbData.check_in_date = appReservation.checkInDate;
  if (appReservation.checkOutDate) dbData.check_out_date = appReservation.checkOutDate;
  if (typeof appReservation.numberOfGuests === "number") {
    dbData.number_of_guests = appReservation.numberOfGuests;
  }
  if (appReservation.status) dbData.status = appReservation.status;
  if (typeof appReservation.notes !== "undefined") {
    dbData.notes = appReservation.notes;
  }
  if (appReservation.folio) {
    dbData.folio = appReservation.folio.map((f) =>
      toDbFolioItem(f, appReservation.id)
    );
  }
  if (typeof appReservation.totalAmount === "number") {
    dbData.total_amount = appReservation.totalAmount;
  }
  if (appReservation.bookingDate) dbData.booking_date = appReservation.bookingDate;
  if (appReservation.source) dbData.source = appReservation.source;
  if (appReservation.paymentMethod) dbData.payment_method = appReservation.paymentMethod;
  if (typeof appReservation.adultCount === "number") {
    dbData.adult_count = appReservation.adultCount;
  }
  if (typeof appReservation.childCount === "number") {
    dbData.child_count = appReservation.childCount;
  }
  if (typeof appReservation.taxEnabledSnapshot === "boolean") {
    dbData.tax_enabled_snapshot = appReservation.taxEnabledSnapshot;
  }
  if (typeof appReservation.taxRateSnapshot === "number") {
    dbData.tax_rate_snapshot = appReservation.taxRateSnapshot;
  }
  if (typeof appReservation.externalSource === "string") {
    dbData.external_source = appReservation.externalSource;
  }
  if (typeof appReservation.externalId !== "undefined") {
    dbData.external_id = appReservation.externalId ?? null;
  }
  if (typeof appReservation.externalMetadata !== "undefined") {
    dbData.external_metadata = appReservation.externalMetadata ?? {};
  }
  return dbData;
};

const fromDbBookingRestriction = (
  row: DbBookingRestriction
): BookingRestriction => ({
  id: row.id,
  name: row.name ?? undefined,
  restrictionType: row.restriction_type,
  value: row.value,
  startDate: row.start_date ?? undefined,
  endDate: row.end_date ?? undefined,
  roomTypeId: row.room_type_id ?? undefined,
});

const fromDbAdminActivityLog = (
  row: DbAdminActivityLog
): AdminActivityLog => ({
  id: row.id,
  actorUserId: row.actor_user_id,
  actorRole: row.actor_role,
  actorName: row.actor_name,
  section: row.section as ActivitySection,
  entityType: row.entity_type as ActivityEntityType | null,
  entityId: row.entity_id,
  entityLabel: row.entity_label,
  action: row.action,
  details: row.details,
  amountMinor: row.amount_minor,
  metadata: row.metadata ?? null,
  createdAt: row.created_at,
});

// --- Blog Transformers ---


// --- File Upload Helper ---

type UploadResponse = {
  url: string;
};

export const uploadFile = async (file: File): Promise<string> => {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch("/api/admin/uploads", {
    method: "POST",
    body: formData,
    credentials: "include",
    cache: "no-store",
  });

  let payload: UploadResponse & { error?: string } | undefined;

  try {
    payload = (await response.json()) as UploadResponse & { error?: string };
  } catch {
    // Ignore JSON parse errors; we'll throw below.
  }

  if (!response.ok || !payload) {
    const message = payload?.error ?? "Upload failed";
    throw new Error(message);
  }

  return payload.url;
};


// --- Activity Logs ---

export const getAdminActivityLogs = async (
  filters: AdminActivityLogFilters = {}
) => {
  const pageSize = typeof filters.limit === "number" && filters.limit > 0 ? filters.limit : 50;
  const page = typeof filters.page === "number" && filters.page > 0 ? filters.page : 1;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('admin_activity_logs')
    .select(ADMIN_ACTIVITY_LOG_SELECT_COLUMNS, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);

  if (filters.section) {
    query = query.eq('section', filters.section);
  }
  if (filters.entityType) {
    query = query.eq('entity_type', filters.entityType);
  }
  if (filters.entityId) {
    query = query.eq('entity_id', filters.entityId);
  }
  if (filters.actorRole) {
    query = query.eq('actor_role', filters.actorRole);
  }
  if (filters.action) {
    query = query.eq('action', filters.action);
  }
  if (filters.from) {
    query = query.gte('created_at', filters.from);
  }
  if (filters.to) {
    query = query.lte('created_at', filters.to);
  }
  const { data, error, count, ...rest } = await query;
  if (error || !data) {
    return { data: [] as AdminActivityLog[], count: count ?? 0, error, ...rest };
  }
  return {
    data: (data as DbAdminActivityLog[]).map(fromDbAdminActivityLog),
    count: count ?? data.length,
    error,
    ...rest,
  };
};

type EntityActivityLogArgs = {
  entityType: ActivityEntityType;
  entityId: string;
  limit?: number;
};

export const getEntityActivityLogs = async (
  args: EntityActivityLogArgs
) =>
  getAdminActivityLogs({
    entityType: args.entityType,
    entityId: args.entityId,
    limit: args.limit,
  });

export const logAdminActivity = async (
  payload: AdminActivityLogPayload
) => {
  const { data, error, ...rest } = await supabase
    .rpc("log_admin_activity_rpc", {
      p_actor_user_id: payload.actorUserId,
      p_section: payload.section,
      p_action: payload.action,
      p_actor_role: payload.actorRole ?? null,
      p_actor_name: payload.actorName ?? null,
      p_entity_type: payload.entityType ?? null,
      p_entity_id: payload.entityId ?? null,
      p_entity_label: payload.entityLabel ?? null,
      p_details: payload.details ?? null,
      p_amount_minor: payload.amountMinor ?? null,
      p_metadata: payload.metadata ?? {},
    });

  if (error || !data) {
    return { data: null, error, ...rest };
  }

  return {
    data: fromDbAdminActivityLog(data as DbAdminActivityLog),
    error,
    ...rest,
  };
};


// --- API Functions ---

// Property
export const getProperty = async (): Promise<{
  data: Property | null;
  error: PostgrestError | null;
}> => {
  const { data, error } = await supabase
    .from('properties')
    .select(PROPERTY_SELECT_COLUMNS)
    .limit(1)
    .single();

  if (error || !data) {
    return { data: null, error: error ?? null };
  }

  return { data: data as Property, error: null };
};
export const updateProperty = (id: string, updatedData: Partial<Property>) => supabase.from('properties').update(updatedData).eq('id', id).select(PROPERTY_SELECT_COLUMNS).single();
export const updatePropertyWithoutReturning = (id: string, updatedData: Partial<Property>) =>
  supabase.from('properties').update(updatedData).eq('id', id);
export const createProperty = (propertyData: Partial<Property>) => supabase.from('properties').insert([propertyData]).select(PROPERTY_SELECT_COLUMNS).single();
export const createPropertyIdAndDefaults = async (propertyData: Partial<Property>) => {
  const { data, error, ...rest } = await supabase
    .from('properties')
    .insert([propertyData])
    .select(PROPERTY_CREATE_RETURN_COLUMNS)
    .single();
  const created = data as
    | {
        id?: string;
        allowSameDayTurnover?: boolean | null;
        showPartialDays?: boolean | null;
        defaultUnitsView?: Property["defaultUnitsView"] | null;
      }
    | null;

  return {
    data:
      typeof created?.id === "string"
        ? {
            id: created.id,
            allowSameDayTurnover: created.allowSameDayTurnover ?? true,
            showPartialDays: created.showPartialDays ?? true,
            defaultUnitsView: created.defaultUnitsView ?? "remaining",
          }
        : null,
    error,
    ...rest,
  };
};

// Guests
const GUEST_PAGE_SIZE = 1000;

export const getGuests = async () => {
  const aggregatedRows: DbGuest[] = [];
  let fromIndex = 0;
  let toIndex = GUEST_PAGE_SIZE - 1;
  let status: number | undefined;
  let statusText: string | undefined;

  while (true) {
    const {
      data,
      error,
      status: pageStatus,
      statusText: pageStatusText,
    } = await supabase
      .from('guests')
      .select(GUEST_SELECT_COLUMNS)
      .order('created_at', { ascending: false })
      .range(fromIndex, toIndex);

    if (typeof status === 'undefined') {
      status = pageStatus;
    }
    if (typeof statusText === 'undefined') {
      statusText = pageStatusText;
    }

    if (error) {
      return {
        data: null,
        error,
        status,
        statusText,
      };
    }

    const rows = (data ?? []) as DbGuest[];
    aggregatedRows.push(...rows);

    if (rows.length < GUEST_PAGE_SIZE) {
      break;
    }

    fromIndex += GUEST_PAGE_SIZE;
    toIndex += GUEST_PAGE_SIZE;
  }

  const dedupedGuests = Array.from(
    aggregatedRows.reduce((map, guest) => {
      if (!map.has(guest.id)) {
        map.set(guest.id, guest);
      }
      return map;
    }, new Map<string, DbGuest>()).values()
  );

  return {
    data: dedupedGuests.map(fromDbGuest),
    error: null,
    status,
    statusText,
  };
};
export const getGuestById = async (id: string) => {
  const { data, error, ...rest } = await supabase.from('guests').select(GUEST_SELECT_COLUMNS).eq('id', id).single();
  if (error || !data) return { data: null, error, ...rest };
  return { data: fromDbGuest(data), error, ...rest };
};
export const getOrCreateGuestByEmail = async (
  args: GetOrCreateGuestArgs
): Promise<{ data: Guest | null; error: PostgrestError | null }> => {
  const { data, error } = await supabase.rpc('get_or_create_booking_guest', {
    p_first_name: args.firstName,
    p_last_name: args.lastName,
    p_email: args.email ?? "",
    p_phone: args.phone,
    p_address: args.address,
    p_pincode: args.pincode,
    p_city: args.city,
    p_state: args.state,
    p_country: args.country,
  });

  if (error) {
    return { data: null, error };
  }

  if (!data) {
    return { data: null, error: null };
  }

  return { data: fromDbGuest(data as unknown as DbGuest), error: null };
};
export const addGuest = async (guestData: Omit<Guest, "id">) => {
  const { data, error, ...rest } = await supabase.from('guests').insert([toDbGuest(guestData)]).select(GUEST_SELECT_COLUMNS).single();
  if (error || !data) return { data, error, ...rest };
  return { data: fromDbGuest(data), error, ...rest };
};
export const addGuestIdOnly = async (guestData: Omit<Guest, "id">) => {
  const { data, error, ...rest } = await supabase
    .from('guests')
    .insert([toDbGuest(guestData)])
    .select('id')
    .single();
  return {
    data: (data as { id?: string } | null)?.id ?? null,
    error,
    ...rest,
  };
};
export const updateGuest = async (id: string, updatedData: Partial<Guest>) => {
  const { data, error, ...rest } = await supabase.from('guests').update(toDbGuest(updatedData)).eq('id', id).select(GUEST_SELECT_COLUMNS).single();
  if (error || !data) return { data, error, ...rest };
  return { data: fromDbGuest(data), error, ...rest };
};
export const updateGuestWithoutReturning = (id: string, updatedData: Partial<Guest>) =>
  supabase.from('guests').update(toDbGuest(updatedData)).eq('id', id);
export const deleteGuest = (id: string) => supabase.from('guests').delete().eq('id', id);

// Reservations
const RESERVATION_PAGE_SIZE = 500;

type ReservationPageParams = {
  limit: number;
  offset?: number;
  includeCount?: boolean;
};

const normalizePageParams = ({
  limit,
  offset = 0,
  includeCount = false,
}: ReservationPageParams): Required<ReservationPageParams> => {
  const safeLimit = Math.max(1, Math.min(limit, RESERVATION_PAGE_SIZE));
  const safeOffset = Math.max(0, offset);
  return { limit: safeLimit, offset: safeOffset, includeCount };
};

export const getReservationsPage = async (
  params: ReservationPageParams
) => {
  const { limit, offset, includeCount } = normalizePageParams(params);
  const toIndex = offset + limit - 1;
  const { data, error, status, statusText, count } = await supabase
    .from('reservations')
    .select(RESERVATION_SELECT_COLUMNS, includeCount ? { count: 'estimated' } : undefined)
    .order('booking_date', { ascending: false, nullsFirst: false })
    .order('id', { ascending: false })
    .range(offset, toIndex);

  if (error || !data) {
    return {
      data: null,
      error,
      status,
      statusText,
      count: includeCount ? count ?? null : null,
    } as const;
  }

  return {
    data: (data as unknown as DbReservation[]).map(fromDbReservation),
    error: null,
    status,
    statusText,
    count: includeCount ? count ?? null : null,
  } as const;
};

export const getReservations = async () => {
  const aggregatedRows: DbReservation[] = [];
  let fromIndex = 0;
  let toIndex = RESERVATION_PAGE_SIZE - 1;
  let status: number | undefined;
  let statusText: string | undefined;
  let count: number | null | undefined;

  while (true) {
    const includeCount = fromIndex === 0;
    const { data, error, status: pageStatus, statusText: pageStatusText, count: pageCount } = await supabase
      .from('reservations')
      .select(RESERVATION_SELECT_COLUMNS, includeCount ? { count: 'estimated' } : undefined)
      .order('booking_date', { ascending: false, nullsFirst: false })
      .order('id', { ascending: false })
      .range(fromIndex, toIndex);

    if (typeof status === 'undefined') {
      status = pageStatus;
    }
    if (typeof statusText === 'undefined') {
      statusText = pageStatusText;
    }
    if (includeCount) {
      count = typeof pageCount === 'number' ? pageCount : null;
    }

    if (error) {
      return {
        data: null,
        error,
        status,
        statusText,
        count,
      };
    }

    const pageRows = (data ?? []) as unknown as DbReservation[];
    aggregatedRows.push(...pageRows);

    if (pageRows.length < RESERVATION_PAGE_SIZE) {
      break;
    }

    fromIndex += RESERVATION_PAGE_SIZE;
    toIndex += RESERVATION_PAGE_SIZE;
  }

  return {
    data: aggregatedRows.map(fromDbReservation),
    error: null,
    status,
    statusText,
    count,
  };
};

export const getReservationsTotalCount = async () => {
  const { count, error, status, statusText } = await supabase
    .from('reservations')
    .select('id', { count: 'exact', head: true });

  if (error) {
    return { count: null, error, status, statusText } as const;
  }

  return { count: count ?? 0, error: null, status, statusText } as const;
};

export const getTotalBookingsCount = async () => {
  const { data, error, status, statusText } = await supabase.rpc(
    'get_total_bookings'
  );

  if (error) {
    return { count: null, error, status, statusText } as const;
  }

  const numericCount =
    typeof data === 'number'
      ? data
      : data === null || typeof data === 'undefined'
        ? 0
        : Number(data);

  return {
    count: Number.isFinite(numericCount) ? numericCount : 0,
    error: null,
    status,
    statusText,
  } as const;
};

export const getReservationById = async (id: string) => {
  const { data, error, ...rest } = await supabase
    .from('reservations')
    .select(RESERVATION_SELECT_COLUMNS)
    .eq('id', id)
    .single();
  if (error || !data) return { data: null, error, ...rest };
  return { data: fromDbReservation(data as unknown as DbReservation), error, ...rest };
};

export const getReservationsByBookingId = async (bookingId: string) => {
  const { data, error, ...rest } = await supabase
    .from('reservations')
    .select(RESERVATION_SELECT_COLUMNS)
    .eq('booking_id', bookingId);

  if (error || !data) return { data: [], error, ...rest };
  return { data: (data as unknown as DbReservation[]).map(fromDbReservation), error, ...rest };
};

export const addReservation = async (reservationsData: DbReservationInsert[]) => {
  const { data, error, ...rest } = await supabase
    .from('reservations')
    .insert(reservationsData)
    .select(RESERVATION_SELECT_COLUMNS);
  if (error || !data) return { data, error, ...rest };
  const typedData = data as unknown as DbReservation[];
  return { data: typedData.map(fromDbReservation), error, ...rest };
};

const toCreateReservationsRpcArgs = (args: CreateReservationsArgs) => {
  validateUUID(args.p_guest_id, 'p_guest_id');
  validateUUID(args.p_rate_plan_id, 'p_rate_plan_id');
  args.p_room_ids.forEach((id, idx) => validateUUID(id, `p_room_ids[${idx}]`));

  if (args.p_custom_totals) {
    const totalsLength = args.p_custom_totals.length;
    if (totalsLength !== args.p_room_ids.length) {
      throw new Error('p_custom_totals length must match p_room_ids length');
    }
    args.p_custom_totals.forEach((value, idx) => {
      if (value === null || typeof value === 'undefined') {
        return;
      }
      if (Number.isNaN(value) || !Number.isFinite(value) || value <= 0) {
        throw new Error(`Invalid custom total at index ${idx}: ${value}`);
      }
    });
  }

  const resolvedBookingId = normalizeBookingCodeInput(args.p_booking_id);
  return {
    ...args,
    p_booking_id: resolvedBookingId,
    p_check_in_date: formatDateForPostgres(args.p_check_in_date),
    p_check_out_date: formatDateForPostgres(args.p_check_out_date),
    p_booking_date: args.p_booking_date
      ? formatTimestampForPostgres(args.p_booking_date)
      : null,
    p_source: args.p_source ?? 'website',
    p_payment_method: args.p_payment_method ?? 'Not specified',
    p_adult_count: args.p_adult_count ?? 1,
    p_child_count: args.p_child_count ?? 0,
    p_tax_enabled_snapshot: args.p_tax_enabled_snapshot ?? false,
    p_tax_rate_snapshot: args.p_tax_rate_snapshot ?? 0,
    p_custom_totals: args.p_custom_totals ?? null,
  };
};

const fromDbReservationCreateReturn = (
  row: DbReservationCreateReturnRow
) => ({
  id: row.id,
  bookingId: row.booking_id,
  roomId: row.room_id,
  totalAmount: Number(row.total_amount ?? 0),
  bookingDate: row.booking_date,
});

export const createReservationsWithTotal = async (
  args: CreateReservationsArgs
): Promise<{ data: Reservation[]; error: PostgrestError | null }> => {
  const validatedArgs = toCreateReservationsRpcArgs(args);
  const { data, error } = await supabase.rpc('create_reservations_with_total', validatedArgs);

  if (error || !data) {
    return { data: [], error: error ?? null };
  }

  const typedData = data as DbReservation[];
  return { data: typedData.map(fromDbReservation), error: null };
};

export const createReservationsWithTotalMinimal = async (
  args: CreateReservationsArgs
) => {
  const validatedArgs = toCreateReservationsRpcArgs(args);
  const { data, error, ...rest } = await supabase
    .rpc('create_reservations_with_total', validatedArgs)
    .select(RESERVATION_CREATE_RETURN_COLUMNS);

  if (error || !data) {
    return { data: [], error: error ?? null, ...rest };
  }

  return {
    data: (data as unknown as DbReservationCreateReturnRow[]).map(
      fromDbReservationCreateReturn
    ),
    error: null,
    ...rest,
  };
};
export const updateReservation = async (id: string, updatedData: Partial<Reservation>) => {
  const { data, error, ...rest } = await supabase.from('reservations').update(toDbReservation(updatedData)).eq('id', id).select(RESERVATION_SELECT_COLUMNS).single();
  if (error || !data) return { data, error, ...rest };
  return { data: fromDbReservation(data as unknown as DbReservation), error, ...rest };
};
export const updateReservationWithoutReturning = (id: string, updatedData: Partial<Reservation>) =>
  supabase.from('reservations').update(toDbReservation(updatedData)).eq('id', id);
export const updateReservationStatus = (id: string, status: string) =>
  supabase.from("reservations").update({ status }).eq("id", id);

export const updateBookingReservationsStatus = async (
  bookingId: string,
  status: ReservationStatus
) => {
  const { data, error } = await supabase
    .from("reservations")
    .update({ status })
    .eq("booking_id", bookingId)
    .select(RESERVATION_SELECT_COLUMNS);

  if (error || !data) {
    return { data: [], error };
  }

  return {
    data: (data as unknown as DbReservation[]).map(fromDbReservation),
    error: null,
  };
};
export const updateBookingReservationsStatusWithoutReturning = (
  bookingId: string,
  status: ReservationStatus
) =>
  supabase
    .from("reservations")
    .update({ status }, { count: "exact" })
    .eq("booking_id", bookingId);

// Folio Items
export const getFolioItems = () => supabase.from('folio_items').select(FOLIO_ITEM_SELECT_COLUMNS);
const toDbFolioItemInsert = (itemData: FolioItemInsertPayload) => ({
  reservation_id: itemData.reservation_id,
  description: itemData.description,
  amount: itemData.amount,
  payment_method: itemData.payment_method ?? null,
  transaction_id: itemData.transaction_id ?? null,
  external_source: itemData.external_source ?? INTERNAL_FOLIO_SOURCE,
  external_reference: itemData.external_reference ?? null,
  external_metadata: itemData.external_metadata ?? {},
  ...(itemData.timestamp ? { timestamp: itemData.timestamp } : {}),
});

export const addFolioItem = (itemData: FolioItemInsertPayload) =>
  supabase
    .from('folio_items')
    .insert([toDbFolioItemInsert(itemData)])
    .select(FOLIO_ITEM_SELECT_COLUMNS)
    .single();

export const addFolioItemIdAndTimestamp = async (itemData: FolioItemInsertPayload) => {
  const { data, error, ...rest } = await supabase
    .from('folio_items')
    .insert([toDbFolioItemInsert(itemData)])
    .select('id, timestamp')
    .single();
  const inserted = data as { id?: string; timestamp?: string | null } | null;

  return {
    data:
      typeof inserted?.id === "string"
        ? { id: inserted.id, timestamp: inserted.timestamp ?? null }
        : null,
    error,
    ...rest,
  };
};

// Reservation Activity Logs (compat helpers)
export const getReservationActivityLogs = async (reservationId: string) =>
  getAdminActivityLogs({
    section: "reservations",
    entityType: "reservation",
    entityId: reservationId,
  });

type LegacyReservationActivityLogInsertPayload = {
  reservation_id: string;
  actor_role: string;
  action: string;
  actor_user_id?: string | null;
  actor_name?: string | null;
  amount_minor?: number | null;
  notes?: string | null;
  metadata?: Record<string, unknown> | null;
};

export const createReservationActivityLog = async (
  payload: LegacyReservationActivityLogInsertPayload
) => {
  if (!payload.actor_user_id) {
    throw new Error("actor_user_id is required for reservation activity logging");
  }

  return logAdminActivity({
    actorUserId: payload.actor_user_id,
    actorRole: payload.actor_role,
    actorName: payload.actor_name,
    section: "reservations",
    entityType: "reservation",
    entityId: payload.reservation_id,
    entityLabel: payload.reservation_id,
    action: payload.action,
    details: payload.notes ?? null,
    amountMinor: payload.amount_minor ?? null,
    metadata: payload.metadata ?? undefined,
  });
};

// Rooms
export const getRooms = async () => {
  const { data, error, ...rest } = await supabase.from('rooms').select(ROOM_SELECT_COLUMNS);
  if (error || !data) return { data, error, ...rest };
  return { data: data.map(fromDbRoom), error, ...rest };
};
export const addRoom = async (roomData: Omit<Room, "id">) => {
  const { data, error, ...rest } = await supabase.from('rooms').insert([toDbRoom(roomData)]).select(ROOM_SELECT_COLUMNS).single();
  if (error || !data) return { data, error, ...rest };
  return { data: fromDbRoom(data), error, ...rest };
};
export const addRoomIdOnly = async (roomData: Omit<Room, "id">) => {
  const { data, error, ...rest } = await supabase
    .from('rooms')
    .insert([toDbRoom(roomData)])
    .select('id')
    .single();
  return {
    data: (data as { id?: string } | null)?.id ?? null,
    error,
    ...rest,
  };
};
export const updateRoom = async (id: string, updatedData: Partial<Room>) => {
  const { data, error, ...rest } = await supabase.from('rooms').update(toDbRoom(updatedData)).eq('id', id).select(ROOM_SELECT_COLUMNS).single();
  if (error || !data) return { data, error, ...rest };
  return { data: fromDbRoom(data), error, ...rest };
};
export const updateRoomWithoutReturning = (id: string, updatedData: Partial<Room>) =>
  supabase.from('rooms').update(toDbRoom(updatedData)).eq('id', id);
export const deleteRoom = (id: string) => supabase.from('rooms').delete().eq('id', id);

// Room Types
export const getRoomTypes = () => supabase.from('room_types').select(ROOM_TYPE_SELECT_COLUMNS);
export const getRoomTypeAmenities = () => supabase.from('room_type_amenities').select(ROOM_TYPE_AMENITY_SELECT_COLUMNS);
const toRoomTypeUpsertParams = (roomTypeData: RoomTypeUpsertInput) => ({
  p_id: roomTypeData.id ?? null,
  p_name: roomTypeData.name,
  p_description: roomTypeData.description,
  p_max_occupancy: roomTypeData.maxOccupancy,
  p_bed_types: roomTypeData.bedTypes,
  p_price: roomTypeData.price,
  p_photos: roomTypeData.photos,
  p_main_photo_url: roomTypeData.mainPhotoUrl,
  p_amenity_ids: roomTypeData.amenities,
  p_is_visible: roomTypeData.isVisible,
});

export const upsertRoomType = (roomTypeData: RoomTypeUpsertInput) =>
  supabase.rpc('upsert_room_type_with_amenities', toRoomTypeUpsertParams(roomTypeData)).single();

export const upsertRoomTypeMinimal = async (roomTypeData: RoomTypeUpsertInput) => {
  const { data, error, ...rest } = await supabase
    .rpc(
      'upsert_room_type_with_amenities_minimal',
      toRoomTypeUpsertParams(roomTypeData)
    )
    .single();
  const row = data as
    | {
        id?: string;
        min_occupancy?: number | null;
        max_children?: number | null;
        category_id?: string | null;
      }
    | null;

  return {
    data:
      typeof row?.id === "string"
        ? {
            id: row.id,
            minOccupancy: row.min_occupancy ?? null,
            maxChildren: row.max_children ?? null,
            categoryId: row.category_id ?? null,
          }
        : null,
    error,
    ...rest,
  };
};
export const deleteRoomType = (id: string) => supabase.from('room_types').delete().eq('id', id);

// Room Categories
export const getRoomCategories = () => supabase.from('room_categories').select(ROOM_CATEGORY_SELECT_COLUMNS);
export const addRoomCategory = (roomCategoryData: Omit<RoomCategory, "id">) => supabase.from('room_categories').insert([roomCategoryData]).select(ROOM_CATEGORY_SELECT_COLUMNS).single();
export const addRoomCategoryIdOnly = async (roomCategoryData: Omit<RoomCategory, "id">) => {
  const { data, error, ...rest } = await supabase
    .from('room_categories')
    .insert([roomCategoryData])
    .select('id')
    .single();
  return {
    data: (data as { id?: string } | null)?.id ?? null,
    error,
    ...rest,
  };
};
export const updateRoomCategory = (id: string, updatedData: Partial<RoomCategory>) => supabase.from('room_categories').update(updatedData).eq('id', id).select(ROOM_CATEGORY_SELECT_COLUMNS).single();
export const updateRoomCategoryWithoutReturning = (
  id: string,
  updatedData: Partial<RoomCategory>
) => supabase.from('room_categories').update(updatedData).eq('id', id);
export const deleteRoomCategory = (id: string) => supabase.from('room_categories').delete().eq('id', id);

// New function for Room Details Page
export const getRoomTypeWithAmenities = async (id: string) => {
  const { data, error } = await supabase
    .from('room_types')
    .select(ROOM_TYPE_WITH_AMENITIES_SELECT_COLUMNS)
    .eq('id', id)
    .single();

  if (error) {
    console.error("Error fetching room type with amenities:", error);
    return { data: null, error };
  }

  if (!data) {
    return { data: null, error: null };
  }

  const { room_type_amenities, ...roomTypeFields } = data as RoomTypeWithAmenitiesRow;
  const roomTypeData: DbRoomType = {
    ...roomTypeFields,
    amenities: (room_type_amenities ?? []).map((rta) => rta.amenity_id),
  };

  return { data: fromDbRoomType(roomTypeData), error: null };
};


// Rate Plans
export const getRatePlans = () => supabase.from('rate_plans').select(RATE_PLAN_SELECT_COLUMNS);
export const addRatePlan = (ratePlanData: Omit<RatePlan, "id">) => supabase.from('rate_plans').insert([ratePlanData]).select(RATE_PLAN_SELECT_COLUMNS).single();
export const addRatePlanIdOnly = async (ratePlanData: Omit<RatePlan, "id">) => {
  const { data, error, ...rest } = await supabase
    .from('rate_plans')
    .insert([ratePlanData])
    .select('id')
    .single();
  return {
    data: (data as { id?: string } | null)?.id ?? null,
    error,
    ...rest,
  };
};
export const updateRatePlan = (id: string, updatedData: Partial<RatePlan>) => supabase.from('rate_plans').update(updatedData).eq('id', id).select(RATE_PLAN_SELECT_COLUMNS).single();
export const updateRatePlanWithoutReturning = (id: string, updatedData: Partial<RatePlan>) =>
  supabase.from('rate_plans').update(updatedData).eq('id', id);
export const deleteRatePlan = (id: string) => supabase.from('rate_plans').delete().eq('id', id);

// Seasonal Prices
type DbSeasonalPrice = {
  id: string;
  room_type_id: string;
  name: string | null;
  price: number;
  start_date: string;
  end_date: string;
  created_at: string;
};

const fromDbSeasonalPrice = (row: DbSeasonalPrice): SeasonalPrice => ({
  id: row.id,
  roomTypeId: row.room_type_id,
  name: row.name ?? "",
  price: Number(row.price),
  startDate: row.start_date,
  endDate: row.end_date,
});

const toDbSeasonalPrice = (
  data: Omit<SeasonalPrice, "id"> | Partial<SeasonalPrice>
): Record<string, unknown> => {
  const payload: Record<string, unknown> = {};
  if ("roomTypeId" in data && data.roomTypeId) payload.room_type_id = data.roomTypeId;
  if ("name" in data && typeof data.name === "string") payload.name = data.name;
  if ("price" in data && typeof data.price === "number") payload.price = data.price;
  if ("startDate" in data && data.startDate) payload.start_date = data.startDate;
  if ("endDate" in data && data.endDate) payload.end_date = data.endDate;
  return payload;
};

export const getSeasonalPrices = async () => {
  const { data, error, ...rest } = await supabase
    .from('seasonal_prices')
    .select(SEASONAL_PRICE_SELECT_COLUMNS)
    .order('start_date');
  if (error || !data) return { data: [] as SeasonalPrice[], error, ...rest };
  return { data: (data as DbSeasonalPrice[]).map(fromDbSeasonalPrice), error, ...rest };
};

export const addSeasonalPrice = async (seasonalPriceData: Omit<SeasonalPrice, "id">) => {
  const { data, error, ...rest } = await supabase
    .from('seasonal_prices')
    .insert([toDbSeasonalPrice(seasonalPriceData)])
    .select(SEASONAL_PRICE_SELECT_COLUMNS)
    .single();
  if (error || !data) return { data: null, error, ...rest };
  return { data: fromDbSeasonalPrice(data as DbSeasonalPrice), error, ...rest };
};
export const addSeasonalPriceIdOnly = async (seasonalPriceData: Omit<SeasonalPrice, "id">) => {
  const { data, error, ...rest } = await supabase
    .from('seasonal_prices')
    .insert([toDbSeasonalPrice(seasonalPriceData)])
    .select('id')
    .single();
  return {
    data: (data as { id?: string } | null)?.id ?? null,
    error,
    ...rest,
  };
};

export const updateSeasonalPrice = async (id: string, updatedData: Partial<SeasonalPrice>) => {
  const { data, error, ...rest } = await supabase
    .from('seasonal_prices')
    .update(toDbSeasonalPrice(updatedData))
    .eq('id', id)
    .select(SEASONAL_PRICE_SELECT_COLUMNS)
    .single();
  if (error || !data) return { data: null, error, ...rest };
  return { data: fromDbSeasonalPrice(data as DbSeasonalPrice), error, ...rest };
};
export const updateSeasonalPriceWithoutReturning = (
  id: string,
  updatedData: Partial<SeasonalPrice>
) => supabase.from('seasonal_prices').update(toDbSeasonalPrice(updatedData)).eq('id', id);

export const deleteSeasonalPrice = (id: string) =>
  supabase.from('seasonal_prices').delete().eq('id', id);

// Roles
export const getRoles = () => supabase.from('roles').select(ROLE_SELECT_COLUMNS);
export const addRole = (roleData: Omit<Role, "id">) => supabase.from('roles').insert([toDbRolePayload(roleData)]).select(ROLE_SELECT_COLUMNS).single();
export const addRoleIdOnly = async (roleData: Omit<Role, "id">) => {
  const { data, error, ...rest } = await supabase
    .from('roles')
    .insert([toDbRolePayload(roleData)])
    .select('id')
    .single();
  return {
    data: (data as { id?: string } | null)?.id ?? null,
    error,
    ...rest,
  };
};
export const updateRole = (id: string, updatedData: Partial<Role>) => supabase.from('roles').update(toDbRolePayload(updatedData)).eq('id', id).select(ROLE_SELECT_COLUMNS).single();
export const updateRoleWithoutReturning = (id: string, updatedData: Partial<Role>) =>
  supabase.from('roles').update(toDbRolePayload(updatedData)).eq('id', id);
export const deleteRole = (id: string) => supabase.from('roles').delete().eq('id', id);

// Users & Profiles
export const getUsers = () => supabase.functions.invoke('get-users');
export const updateUserProfile = (id: string, updatedData: UpdateUserProfilePayload) => {
  return supabase.from('profiles').update(toDbUserProfilePayload(updatedData)).eq('id', id).select(PROFILE_SELECT_COLUMNS).single();
};
export const updateUserProfileWithoutReturning = (
  id: string,
  updatedData: UpdateUserProfilePayload
) => supabase.from('profiles').update(toDbUserProfilePayload(updatedData)).eq('id', id);
export const deleteAuthUser = (id: string) => supabase.functions.invoke('delete-user', { body: { userIdToDelete: id } });
export const getUserProfile = (id: string) => supabase.from('profiles').select(USER_PROFILE_SELECT_COLUMNS).eq('id', id).single();

// Amenities
export const getAmenities = () => supabase.from('amenities').select(AMENITY_SELECT_COLUMNS);
export const addAmenity = (amenityData: Omit<Amenity, "id">) => supabase.from('amenities').insert([amenityData]).select(AMENITY_SELECT_COLUMNS).single();
export const addAmenityIdOnly = async (amenityData: Omit<Amenity, "id">) => {
  const { data, error, ...rest } = await supabase
    .from('amenities')
    .insert([amenityData])
    .select('id')
    .single();
  return {
    data: (data as { id?: string } | null)?.id ?? null,
    error,
    ...rest,
  };
};
export const updateAmenity = (id: string, updatedData: Partial<Amenity>) => supabase.from('amenities').update(updatedData).eq('id', id).select(AMENITY_SELECT_COLUMNS).single();
export const updateAmenityWithoutReturning = (id: string, updatedData: Partial<Amenity>) =>
  supabase.from('amenities').update(updatedData).eq('id', id);
export const deleteAmenity = (id: string) => supabase.from('amenities').delete().eq('id', id);

// Sticky Notes
export const getStickyNotes = (userId: string) => supabase.from('sticky_notes').select(STICKY_NOTE_SELECT_COLUMNS).eq('user_id', userId);
export const addStickyNote = (noteData: StickyNoteInsertPayload) =>
  supabase.from('sticky_notes').insert([noteData]).select(STICKY_NOTE_SELECT_COLUMNS).single();
export const addStickyNoteIdOnly = async (noteData: StickyNoteInsertPayload) => {
  const { data, error, ...rest } = await supabase
    .from('sticky_notes')
    .insert([noteData])
    .select('id')
    .single();
  return {
    data: (data as { id?: string } | null)?.id ?? null,
    error,
    ...rest,
  };
};
export const updateStickyNote = (id: string, updatedData: Partial<StickyNote>) => supabase.from('sticky_notes').update(updatedData).eq('id', id).select(STICKY_NOTE_SELECT_COLUMNS).single();
export const updateStickyNoteWithoutReturning = (id: string, updatedData: Partial<StickyNote>) =>
  supabase.from('sticky_notes').update(updatedData).eq('id', id);
export const deleteStickyNote = (id: string) => supabase.from('sticky_notes').delete().eq('id', id);

// Housekeeping
export const getHousekeepingAssignments = (date: string) =>
  supabase
    .from('housekeeping_assignments')
    .select(HOUSEKEEPING_ASSIGNMENT_SELECT_COLUMNS)
    .eq('date', date);

// Booking Restrictions
export const getBookingRestrictions = async (): Promise<BookingRestriction[]> => {
  const { data, error } = await supabase
    .from('booking_restrictions')
    .select(BOOKING_RESTRICTION_SELECT_COLUMNS)
    .order('created_at');

  if (error) throw error;
  return (data ?? []).map((row) => fromDbBookingRestriction(row as DbBookingRestriction));
};

// Property Closures (Blocked Date Ranges)
type DbPropertyClosure = {
  id: string;
  property_id: string;
  room_type_id: string | null;
  start_date: string;
  end_date: string;
  reason: string | null;
  created_at: string;
  updated_at: string;
};

const fromDbPropertyClosure = (row: DbPropertyClosure): PropertyClosure => ({
  id: row.id,
  propertyId: row.property_id,
  roomTypeId: row.room_type_id ?? undefined,
  startDate: row.start_date,
  endDate: row.end_date,
  reason: row.reason ?? undefined,
});

const toDbPropertyClosure = (
  data: Partial<Omit<PropertyClosure, "id">>
): Record<string, unknown> => {
  const payload: Record<string, unknown> = {};
  if (data.propertyId !== undefined) payload.property_id = data.propertyId;
  if ("roomTypeId" in data) payload.room_type_id = data.roomTypeId ?? null;
  if (data.startDate !== undefined) payload.start_date = data.startDate;
  if (data.endDate !== undefined) payload.end_date = data.endDate;
  if ("reason" in data) payload.reason = data.reason ?? null;
  return payload;
};

export const getPropertyClosures = async (): Promise<PropertyClosure[]> => {
  const { data, error } = await supabase
    .from('property_closures')
    .select(PROPERTY_CLOSURE_SELECT_COLUMNS)
    .order('start_date');

  if (error) throw error;
  return (data ?? []).map((row) => fromDbPropertyClosure(row as DbPropertyClosure));
};

export const addPropertyClosure = async (
  closureData: Omit<PropertyClosure, "id">
): Promise<{ data: PropertyClosure | null; error: PostgrestError | null }> => {
  const { data, error } = await supabase
    .from('property_closures')
    .insert([toDbPropertyClosure(closureData)])
    .select(PROPERTY_CLOSURE_SELECT_COLUMNS)
    .single();

  if (error || !data) return { data: null, error };
  return { data: fromDbPropertyClosure(data as DbPropertyClosure), error: null };
};
export const addPropertyClosureIdOnly = async (
  closureData: Omit<PropertyClosure, "id">
): Promise<{ data: string | null; error: PostgrestError | null }> => {
  const { data, error } = await supabase
    .from('property_closures')
    .insert([toDbPropertyClosure(closureData)])
    .select('id')
    .single();

  return { data: (data as { id?: string } | null)?.id ?? null, error };
};

export const updatePropertyClosure = async (
  id: string,
  updatedData: Partial<Omit<PropertyClosure, "id">>
): Promise<{ data: PropertyClosure | null; error: PostgrestError | null }> => {
  const { data, error } = await supabase
    .from('property_closures')
    .update(toDbPropertyClosure(updatedData))
    .eq('id', id)
    .select(PROPERTY_CLOSURE_SELECT_COLUMNS)
    .single();

  if (error || !data) return { data: null, error };
  return { data: fromDbPropertyClosure(data as DbPropertyClosure), error: null };
};

export const updatePropertyClosureWithoutReturning = (
  id: string,
  updatedData: Partial<Omit<PropertyClosure, "id">>
) =>
  supabase
    .from('property_closures')
    .update(toDbPropertyClosure(updatedData))
    .eq('id', id);

export const deletePropertyClosure = (id: string) =>
  supabase.from('property_closures').delete().eq('id', id);

export type BookingValidationResult = {
  isValid: boolean;
  message?: string;
  conflicts?: Array<Pick<Reservation, "id" | "bookingId" | "roomId" | "checkInDate" | "checkOutDate" | "status">>;
};

export const validateBookingRequest = async (
  checkIn: string,
  checkOut: string,
  roomId: string,
  adults: number,
  children: number = 0,
  bookingId?: string
): Promise<BookingValidationResult> => {
  const { data, error } = await supabase.rpc('validate_booking_request', {
    p_check_in: checkIn,
    p_check_out: checkOut,
    p_room_id: roomId,
    p_adults: adults,
    p_children: children
  });

  if (error) throw error;
  if (data && data.isValid === false) {
    return data as BookingValidationResult;
  }

  let conflictsQuery = supabase
    .from('reservations')
    .select('id, booking_id, room_id, check_in_date, check_out_date, status')
    .eq('room_id', roomId)
    .neq('status', 'Cancelled')
    .lt('check_in_date', checkOut)
    .gt('check_out_date', checkIn);

  if (bookingId) {
    conflictsQuery = conflictsQuery.neq('booking_id', bookingId);
  }

  const { data: conflicts, error: conflictsError } = await conflictsQuery;
  if (conflictsError) throw conflictsError;

  if (conflicts && conflicts.length) {
    return {
      isValid: false,
      message: 'Room unavailable for selected dates',
      conflicts: conflicts.map((conflict) => ({
        id: conflict.id,
        bookingId: conflict.booking_id,
        roomId: conflict.room_id,
        checkInDate: conflict.check_in_date,
        checkOutDate: conflict.check_out_date,
        status: conflict.status,
      })),
    } satisfies BookingValidationResult;
  }

  return { isValid: true } satisfies BookingValidationResult;
};

// Blog API

// Categories
export const getCategories = async () => {
  const { data: categories, error: catError } = await supabase
    .from('categories')
    .select(CATEGORY_SELECT_COLUMNS)
    .order('name');
  if (catError) throw catError;
  return categories.map(fromDbCategory);
};

export const getCategoryById = async (id: string) => {
  const { data, error } = await supabase.from('categories').select(CATEGORY_SELECT_COLUMNS).eq('id', id).single();
  if (error) throw error;
  return fromDbCategory(data);
};

type CategoryCreateData = Omit<Category, "id" | "created_at" | "_count">;

const toDbCategoryInsertPayload = (
  categoryData: CategoryCreateData
): DbCategoryInsertPayload => ({
  name: categoryData.name,
  slug: categoryData.slug,
  description: categoryData.description ?? null,
  parent_id: categoryData.parent_id ?? null,
});

export const createCategory = async (categoryData: CategoryCreateData) => {
  const { data, error } = await supabase
    .from('categories')
    .insert([toDbCategoryInsertPayload(categoryData)])
    .select(CATEGORY_SELECT_COLUMNS)
    .single();

  if (error) throw error;
  return fromDbCategory(data);
};

export const createCategoryIdOnly = async (
  categoryData: CategoryCreateData
) => {
  const { data, error } = await supabase
    .from('categories')
    .insert([toDbCategoryInsertPayload(categoryData)])
    .select('id')
    .single();

  if (error) throw error;

  const categoryId = (data as DbCategoryIdRow | null)?.id;
  if (!categoryId) {
    throw new Error("Created category id was not returned");
  }

  return categoryId;
};

const toDbCategoryUpdatePayload = (
  categoryData: Partial<Category>
): DbCategoryUpdatePayload => {
  const updatePayload: DbCategoryUpdatePayload = {};
  if (categoryData.name) updatePayload.name = categoryData.name;
  if (categoryData.slug) updatePayload.slug = categoryData.slug;
  if (categoryData.description !== undefined) updatePayload.description = categoryData.description;
  if (categoryData.parent_id !== undefined) updatePayload.parent_id = categoryData.parent_id;
  return updatePayload;
};

export const updateCategory = async (
  id: string,
  categoryData: Partial<Category>
) => {
  const updatePayload = toDbCategoryUpdatePayload(categoryData);

  const { data, error } = await supabase
    .from('categories')
    .update(updatePayload)
    .eq('id', id)
    .select(CATEGORY_SELECT_COLUMNS)
    .single();
  if (error) throw error;
  return fromDbCategory(data as DbCategory);
};

export const updateCategoryWithoutReturning = async (
  id: string,
  categoryData: Partial<Category>
) => {
  const { error } = await supabase
    .from('categories')
    .update(toDbCategoryUpdatePayload(categoryData))
    .eq('id', id);
  if (error) throw error;
};

export const deleteCategory = async (id: string) => {
  const { error } = await supabase.from('categories').delete().eq('id', id);
  if (error) throw error;
};

type PostCreateData = Omit<Post, "id" | "created_at" | "updated_at" | "categories"> & {
  categoryIds?: string[];
};

const toDbPostInsertPayload = (postData: PostCreateData): DbPostInsertPayload => ({
  title: postData.title,
  slug: postData.slug,
  content: postData.content ?? null,
  excerpt: postData.excerpt ?? null,
  featured_image: postData.featured_image ?? null,
  status: postData.status,
  published_at: postData.status === 'published' ? new Date().toISOString() : null,
  author_id: postData.author_id // Assuming passed or handled by RLS default
});

const toPostCategoryInserts = (postId: string, categoryIds: string[]) =>
  categoryIds.map(catId => ({
    post_id: postId,
    category_id: catId
  }));

export const createPost = async (postData: PostCreateData) => {
  // 1. Insert Post
  const { data: post, error } = await supabase
    .from('posts')
    .insert([toDbPostInsertPayload(postData)])
    .select(POST_SELECT_COLUMNS)
    .single();

  if (error) throw error;

  // 2. Insert Categories
  if (postData.categoryIds && postData.categoryIds.length > 0) {
    const categoryInserts = toPostCategoryInserts(post.id, postData.categoryIds);
    const { error: catError } = await supabase.from('post_categories').insert(categoryInserts);
    if (catError) throw catError; // Note: might want to rollback post if this fails
  }

  return fromDbPost(post);
};

export const createPostWithoutReturning = async (postData: PostCreateData) => {
  const { data: post, error } = await supabase
    .from('posts')
    .insert([toDbPostInsertPayload(postData)])
    .select('id')
    .single();

  if (error) throw error;

  const postId = (post as DbPostIdRow | null)?.id;
  if (!postId) {
    throw new Error("Created post id was not returned");
  }

  if (postData.categoryIds && postData.categoryIds.length > 0) {
    const categoryInserts = toPostCategoryInserts(postId, postData.categoryIds);
    const { error: catError } = await supabase.from('post_categories').insert(categoryInserts);
    if (catError) throw catError;
  }
};

type PostUpdateData = Partial<Post> & { categoryIds?: string[] };

const toDbPostUpdatePayload = (postData: PostUpdateData): DbPostUpdatePayload => {
  const updatePayload: DbPostUpdatePayload = {
    updated_at: new Date().toISOString(),
  };
  if (postData.title) updatePayload.title = postData.title;
  if (postData.slug) updatePayload.slug = postData.slug;
  if (postData.content !== undefined) updatePayload.content = postData.content;
  if (postData.excerpt !== undefined) updatePayload.excerpt = postData.excerpt;
  if (postData.featured_image !== undefined) updatePayload.featured_image = postData.featured_image;
  if (postData.status) {
    updatePayload.status = postData.status;
    if (postData.status === 'published' && !postData.published_at) {
      updatePayload.published_at = new Date().toISOString();
    }
  }
  return updatePayload;
};

const syncPostCategories = async (
  id: string,
  categoryIds?: string[]
) => {
  if (!categoryIds) {
    return;
  }

  // Remove old
  await supabase.from('post_categories').delete().eq('post_id', id);
  // Add new
  if (categoryIds.length > 0) {
    const categoryInserts = toPostCategoryInserts(id, categoryIds);
    await supabase.from('post_categories').insert(categoryInserts);
  }
};

export const updatePost = async (
  id: string,
  postData: PostUpdateData
) => {
  const updatePayload = toDbPostUpdatePayload(postData);

  const { data: post, error } = await supabase
    .from('posts')
    .update(updatePayload)
    .eq('id', id)
    .select(POST_SELECT_COLUMNS)
    .single();
  if (error) throw error;

  await syncPostCategories(id, postData.categoryIds);

  return fromDbPost(post as DbPost);
};

export const updatePostWithoutReturning = async (
  id: string,
  postData: PostUpdateData
) => {
  const { error } = await supabase
    .from('posts')
    .update(toDbPostUpdatePayload(postData))
    .eq('id', id);
  if (error) throw error;

  await syncPostCategories(id, postData.categoryIds);
};

export const deletePost = async (id: string) => {
  const { error } = await supabase.from('posts').delete().eq('id', id);
  if (error) throw error;
};




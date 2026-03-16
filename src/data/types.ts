export type UserRole = "manager" | "receptionist" | "housekeeper";

export type PermissionAction = "create" | "read" | "update" | "delete";
export type PermissionResource =
  | "guest"
  | "reservation"
  | "room"
  | "room_type"
  | "room_category"
  | "rate_plan"
  | "seasonal_price"
  | "report"
  | "setting"
  | "user"
  | "post"
  | "feedback"
  | "review"
  | "donation";
export type Permission = `${PermissionAction}:${PermissionResource}`;

export const allPermissions: readonly Permission[] = [
  "create:guest", "read:guest", "update:guest", "delete:guest",
  "create:reservation", "read:reservation", "update:reservation", "delete:reservation",
  "create:room", "read:room", "update:room", "delete:room",
  "create:room_type", "read:room_type", "update:room_type", "delete:room_type",
  "create:room_category", "read:room_category", "update:room_category", "delete:room_category",
  "create:rate_plan", "read:rate_plan", "update:rate_plan", "delete:rate_plan",
  "create:seasonal_price", "read:seasonal_price", "update:seasonal_price", "delete:seasonal_price",
  "create:post", "read:post", "update:post", "delete:post",
  "create:feedback", "read:feedback", "update:feedback", "delete:feedback",
  "create:review", "read:review", "update:review", "delete:review",
  "create:donation", "read:donation", "update:donation", "delete:donation",
  "read:report",
  "update:setting",
  "create:user", "read:user", "update:user", "delete:user",
] as const;

export type DashboardComponentId = 'stats' | 'tables' | 'notes' | 'calendar';

export interface Role {
  id: string;
  name: string;
  permissions: Permission[];
  hierarchyLevel: number;
}

export interface User {
  id: string;
  name: string;
  email: string;
  roleId: string;
  avatarUrl?: string;
}

export interface Property {
  id: string;
  name: string;
  address: string;
  phone: string;
  email: string;
  logo_url: string;
  photos: string[];
  google_maps_url: string;
  timezone: string;
  currency: string;
  allowSameDayTurnover: boolean;
  showPartialDays: boolean;
  defaultUnitsView: UnitsViewMode;
  tax_enabled: boolean;
  tax_percentage: number;
  trust_registration_no?: string;
  trust_date?: string;
  pan_no?: string;
  certificate_no?: string;
}

export type UnitsViewMode = 'remaining' | 'booked';

export type AvailabilityCellStatus = 'free' | 'partial' | 'busy' | 'closed';

export interface RoomDayReservation {
  reservationId: string;
  guestId: string;
  checkInDate: string;
  checkOutDate: string;
}

export interface AvailabilityDay {
  date: string;
  status: AvailabilityCellStatus;
  unitsTotal: number;
  bookedCount: number;
  reservationIds: string[];
  hasCheckIn: boolean;
  hasCheckOut: boolean;
  isClosed: boolean;
  roomReservations: Record<string, RoomDayReservation>;
}

export interface RoomAvailabilityMeta {
  id: string;
  name: string;
  description: string;
  mainPhotoUrl?: string;
  price?: number | null;
  rooms: Array<{ id: string; roomNumber: string }>;
  units: number;
  sharedInventory: boolean;
}

export interface RoomTypeAvailability {
  roomType: RoomAvailabilityMeta;
  availability: AvailabilityDay[];
}

export interface Amenity {
  id: string;
  name: string;
  icon: string; // lucide-react icon name
}

// Enhanced room type with new fields
export interface RoomType {
  id: string;
  name: string;
  description: string;
  maxOccupancy: number;
  minOccupancy?: number; // Minimum guests required
  maxChildren?: number; // Maximum children allowed
  bedTypes: string[];
  price: number;
  categoryId?: string; // Optional category filter
  amenities: string[]; // Array of Amenity IDs
  photos: string[];
  mainPhotoUrl?: string;
  isVisible: boolean;
}

export interface RoomCategory {
  id: string;
  name: string;
  description: string;
}

// Booking restrictions
export interface BookingRestriction {
  id: string;
  name?: string;
  restrictionType: 'min_stay' | 'checkin_days' | 'season';
  value: {
    minNights?: number;
    allowedDays?: number[];
    seasonalPrice?: number;
    closed?: boolean;
  };
  startDate?: string;
  endDate?: string;
  roomTypeId?: string;
}

// Room occupancy configuration
export interface RoomOccupancy {
  adults: number;
  children: number;
}

// Booking search parameters
export interface BookingSearchParams {
  dateRange: {
    from: Date;
    to: Date;
  };
  roomOccupancies: RoomOccupancy[];
  categoryIds?: string[];
}

// Booking validation result
export interface BookingValidation {
  isValid: boolean;
  message?: string;
  restrictions?: string[];
}

export type RoomStatus = "Clean" | "Dirty" | "Inspected" | "Maintenance";

export interface Room {
  id: string;
  roomNumber: string;
  roomTypeId: string;
  status: RoomStatus;
  photos?: string[];
}

export interface RatePlan {
  id: string;
  name: string;
  price: number; // per night
  rules: {
    minStay: number;
    cancellationPolicy: string;
  };
}

export interface SeasonalPrice {
  id: string;
  roomTypeId: string;
  name: string;
  price: number;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
}

export interface Guest {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address?: string;
  pincode?: string;
  city?: string;
  country?: string;
  state?: string;
  avatarUrl?: string;
}

export type ReservationStatus =
  | "Tentative"
  | "Standby"
  | "Confirmed"
  | "Checked-in"
  | "Checked-out"
  | "Cancelled"
  | "No-show";

export type ReservationPaymentMethod =
  | "Not specified"
  | "Bank/IMPS"
  | "Cash"
  | "UPI"
  | "Bhagat Ji"
  | "Anurag Ji";

export interface FolioItem {
  id: string;
  description: string;
  amount: number;
  timestamp: string;
  paymentMethod?: string | null;
  externalSource?: string | null;
  externalReference?: string | null;
  externalMetadata?: Record<string, unknown> | null;
}

export type ActivitySection =
  | "reservations"
  | "guests"
  | "rooms"
  | "room_types"
  | "room_categories"
  | "rate_plans"
  | "seasonal_prices"
  | "housekeeping"
  | "property"
  | "roles"
  | "users"
  | "amenities"
  | "sticky_notes"
  | "posts"
  | "donations"
  | "feedback"
  | "dashboard"
  | "settings"
  | "system";

export type ActivityEntityType =
  | "reservation"
  | "guest"
  | "room"
  | "room_type"
  | "room_category"
  | "rate_plan"
  | "seasonal_price"
  | "housekeeping_assignment"
  | "property"
  | "role"
  | "user"
  | "amenity"
  | "sticky_note"
  | "post"
  | "donation"
  | "feedback"
  | "dashboard_layout";

export interface AdminActivityLog {
  id: string;
  actorUserId?: string | null;
  actorRole: string;
  actorName?: string | null;
  section: ActivitySection;
  entityType?: ActivityEntityType | null;
  entityId?: string | null;
  entityLabel?: string | null;
  action: string;
  details?: string | null;
  amountMinor?: number | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
}

export interface NewAdminActivityLog {
  actorUserId?: string | null;
  actorRole?: string | null;
  actorName?: string | null;
  section: ActivitySection;
  entityType?: ActivityEntityType | null;
  entityId?: string | null;
  entityLabel?: string | null;
  action: string;
  details?: string | null;
  amountMinor?: number | null;
  metadata?: Record<string, unknown> | null;
}

export type AdminActivityLogInput = Omit<NewAdminActivityLog, "actorUserId" | "actorRole" | "actorName">;

export interface AdminActivityActor {
  actorUserId: string;
  actorRole?: string | null;
  actorName?: string | null;
}

export type AdminActivityLogPayload = AdminActivityLogInput & AdminActivityActor;

export type DonationFrequency = "one_time" | "monthly";
export type DonationStatus = "pending" | "paid" | "failed" | "refunded";

export interface Donation {
  id: string;
  donorName: string;
  email: string;
  phone: string;
  amountInMinor: number;
  currency: string;
  frequency: DonationFrequency;
  message?: string;
  consent: boolean;
  paymentProvider: string;
  paymentStatus: DonationStatus;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  razorpaySignature?: string;
  upiReference?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface DonationStats {
  totalAmountInMinor: number;
  totalDonations: number;
  monthlyDonations: number;
  lastDonationAt?: string;
}

export type ReservationSource = 'reception' | 'website' | 'vikbooking';

export type ReservationGuestSnapshot = {
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
};

export interface Reservation {
  id: string;
  bookingId: string; // Shared ID for multi-room bookings
  guestId: string;
  roomId: string;
  ratePlanId: string | null;
  checkInDate: string;
  checkOutDate: string;
  numberOfGuests: number;
  status: ReservationStatus;
  notes?: string;
  folio: FolioItem[];
  totalAmount: number;
  bookingDate: string;
  source: ReservationSource;
  paymentMethod: ReservationPaymentMethod;
  adultCount: number;
  childCount: number;
  taxEnabledSnapshot: boolean;
  taxRateSnapshot: number;
  externalSource?: string;
  externalId?: string | null;
  externalMetadata?: Record<string, unknown> | null;
  guestSnapshot?: ReservationGuestSnapshot;
}

export type BookingSummary = {
  id: string;
  bookingId: string;
  bookingDate: string;
  guestId: string;
  guestName: string;
  guestSnapshot: {
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    phone: string | null;
  };
  totalAmount: number;
  roomCount: number;
  checkInDate: string;
  checkOutDate: string;
  numberOfGuests: number;
  adultCount: number;
  childCount: number;
  status: ReservationStatus;
  source: string;
  paymentMethod: string;
  nights: number;
  roomNumber: string;
  displayAmount?: number;
  folio: FolioItem[];
  subRows: (Reservation & { guestName: string; nights: number; displayAmount?: number })[];
};

export type ReservationPageResult = {
  data: BookingSummary[];
  nextOffset: number | null;
  totalCount: number | null;
};

export interface ExternalRoomLink {
  id: string;
  source: string;
  externalLabel: string;
  roomId: string;
  createdAt: string;
  updatedAt: string;
}

export interface RoomNumberLink {
  id: string;
  source: string;
  externalNumber: string;
  externalNumberNormalized: string;
  roomId: string;
  createdAt: string;
  updatedAt: string;
}

export type ImportJobStatus =
  | 'pending'
  | 'validating'
  | 'requires_mapping'
  | 'running'
  | 'completed'
  | 'failed';

export type ImportJobEntryStatus = 'pending' | 'skipped' | 'imported' | 'error';

export interface ImportJob {
  id: string;
  source: string;
  status: ImportJobStatus;
  fileName?: string;
  fileHash?: string;
  totalRows: number;
  processedRows: number;
  errorRows: number;
  summary: Record<string, unknown>;
  metadata: Record<string, unknown>;
  createdBy?: string | null;
  createdAt: string;
  completedAt?: string | null;
  lastError?: string | null;
}

export interface ImportJobEntry {
  id: string;
  jobId: string;
  rowNumber: number;
  status: ImportJobEntryStatus;
  message?: string | null;
  payload: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface HousekeepingAssignment {
  roomId: string;
  assignedTo: string; // userId of housekeeper
  date: string;
  status: "Pending" | "Completed";
}

export interface StickyNote {
  id: string;
  title: string;
  description?: string;
  color: 'yellow' | 'pink' | 'blue' | 'green';
  createdAt: string;
}

export interface EventBanner {
  id: string;
  title: string;
  description?: string;
  imageUrl: string;
  isActive: boolean;
  startsAt?: string;
  endsAt?: string;
  createdAt: string;
  updatedAt: string;
  updatedBy?: string;
}

export interface Review {
  id: string;
  reviewerName: string;
  reviewerTitle?: string;
  content: string;
  imageUrl: string;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
  updatedBy?: string;
}

// Blog
export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  parent_id?: string;
  created_at: string;
  parent?: Category;
  _count?: {
    posts: number;
  };
}

export interface Post {
  id: string;
  title: string;
  slug: string;
  content?: string;
  excerpt?: string;
  featured_image?: string;
  status: 'draft' | 'published';
  published_at?: string;
  author_id: string;
  created_at: string;
  updated_at: string;
  categories?: Category[];
  author?: {
    email: string;
    full_name?: string;
  };
}

export type FeedbackType = "suggestion" | "praise" | "complaint" | "question";

export type FeedbackStatus = "new" | "in_review" | "resolved";

export interface Feedback {
  id: string;
  feedbackType: FeedbackType;
  message: string;
  name?: string;
  isAnonymous: boolean;
  email?: string;
  roomOrFacility?: string;
  rating?: number;
  status: FeedbackStatus;
  internalNote?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FeedbackFilters {
  type?: FeedbackType;
  status?: FeedbackStatus;
  search?: string;
  startDate?: string;
  endDate?: string;
  roomOrFacility?: string;
}

export interface ManualReceipt {
  id: string;
  slipNo: number;
  firstName: string;
  lastName: string;
  phone: string;
  email: string | null;
  address: string | null;
  amount: number;
  paymentMethod: string;
  transactionId: string | null;
  note: string | null;
  status: string;
  byHand: string | null;
  creator: string | null;
  imgLink: string | null;
  createdAt: string;
}

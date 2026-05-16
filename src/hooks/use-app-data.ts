"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { useSessionContext } from "@/context/session-context";
import { useActivityLogger } from "@/hooks/use-activity-logger";
import {
  getAppDataLoadPlan,
  isAppDataDatasetEnabled,
} from "@/hooks/app-data-load-plan";
import * as api from "@/lib/api";
import { extractChangedFields } from "@/lib/activity/change-detector";
import { authorizedFetch } from "@/lib/auth/client-session";
import { revalidateReservationsCache } from "@/lib/reservations/cache-client";
import { sortReservationsByBookingDate } from "@/lib/reservations/sort";
import {
  buildRoomOccupancyAssignments,
  type RoomOccupancyAssignment,
} from "@/lib/reservations/guest-allocation";
import type {
  Reservation,
  BookingSummary,
  Guest,
  ReservationStatus,
  FolioItem,
  HousekeepingAssignment,
  Room,
  RoomType,
  RoomCategory,
  RatePlan,
  SeasonalPrice,
  PropertyClosure,
  Property,
  User,
  Role,
  Amenity,
  StickyNote,
  DashboardComponentId,
  AdminActivityLogInput,
} from "@/data/types";

type RoleRow = Pick<Role, "id" | "name"> &
  Partial<Pick<Role, "permissions" | "hierarchyLevel">> & {
    hierarchy_level?: number;
  };

const mapDbRole = (role: RoleRow): Role => ({
  id: role.id,
  name: role.name,
  permissions: role.permissions ?? [],
  hierarchyLevel: typeof role.hierarchyLevel === "number" ? role.hierarchyLevel : role.hierarchy_level ?? 0,
});

type RoomTypeAmenityRecord = { room_type_id: string; amenity_id: string };

type CreateReservationPayload = {
  guestId: string;
  roomIds: string[];
  roomOccupancies?: RoomOccupancyAssignment[];
  ratePlanId: string;
  checkInDate: string;
  checkOutDate: string;
  /**
   * Total number of guests for the entire booking (all rooms combined).
   * The backend procedure is responsible for distributing this value
   * across individual reservations so that each reservation.numberOfGuests
   * reflects guests per room for the stay, not multiplied by nights.
   */
  numberOfGuests: number;
  adultCount: number;
  childCount: number;
  status: ReservationStatus;
  notes?: string;
  bookingDate: string;
  source: Reservation["source"];
  paymentMethod: Reservation["paymentMethod"];
  customRoomTotals?: Array<number | null>;
};

type AddRoomsToBookingPayload = {
  bookingId: string;
  roomIds: string[];
  roomOccupancies?: RoomOccupancyAssignment[];
  guestId: string;
  ratePlanId: string;
  checkInDate: string;
  checkOutDate: string;
  numberOfGuests: number;
  adultCount: number;
  childCount: number;
  status: ReservationStatus;
  notes?: string;
  bookingDate: string;
  source: Reservation["source"];
  paymentMethod: Reservation["paymentMethod"];
  taxEnabledSnapshot: boolean;
  taxRateSnapshot: number;
  customRoomTotals?: Array<number | null>;
};

type UserProfileUpdate = Partial<Pick<User, "name" | "roleId">>;

const normalizeRoomOccupancies = (
  roomIds: string[],
  totalAdults: number,
  totalChildren: number,
  explicit?: RoomOccupancyAssignment[]
): RoomOccupancyAssignment[] => {
  if (!roomIds.length) {
    return [];
  }

  if (!explicit?.length) {
    return buildRoomOccupancyAssignments(roomIds, totalAdults, totalChildren);
  }

  const fallback = buildRoomOccupancyAssignments(roomIds, totalAdults, totalChildren);
  const byRoomId = new Map<string, RoomOccupancyAssignment>();

  explicit.forEach((entry, index) => {
    const key = entry.roomId ?? roomIds[index];
    if (!key) return;
    byRoomId.set(key, {
      roomId: key,
      adults: Math.max(entry.adults, 0),
      children: Math.max(entry.children, 0),
    });
  });

  return roomIds.map((roomId, index) => {
    const direct = byRoomId.get(roomId);
    if (direct) {
      return direct;
    }

    const positional = explicit[index];
    if (positional) {
      return {
        roomId,
        adults: Math.max(positional.adults, 0),
        children: Math.max(positional.children, 0),
      };
    }

    return fallback[index];
  });
};

const definedReservationUpdate = (
  updatedData: Partial<Omit<Reservation, "id">>
): Partial<Omit<Reservation, "id">> =>
  Object.fromEntries(
    Object.entries(updatedData).filter(([, value]) => typeof value !== "undefined")
  ) as Partial<Omit<Reservation, "id">>;

const mergeReservationUpdate = (
  reservation: Reservation,
  updatedData: Partial<Omit<Reservation, "id">>
): Reservation => ({
  ...reservation,
  ...definedReservationUpdate(updatedData),
});

const applyRoomOccupancyAssignments = async (
  reservationsList: Reservation[],
  assignments: RoomOccupancyAssignment[]
): Promise<Reservation[]> => {
  if (!assignments.length) {
    return reservationsList;
  }

  const byRoomId = new Map<string | undefined, RoomOccupancyAssignment>();
  assignments.forEach((assignment) => {
    if (assignment.roomId) {
      byRoomId.set(assignment.roomId, assignment);
    }
  });

  const updated = await Promise.all(
    reservationsList.map(async (reservation, index) => {
      const assignment = reservation.roomId
        ? byRoomId.get(reservation.roomId) ?? assignments[index]
        : assignments[index];

      if (!assignment) {
        return reservation;
      }

      const adults = Math.max(assignment.adults, 0);
      const children = Math.max(assignment.children, 0);
      const guests = adults + children;

      if (
        reservation.adultCount === adults &&
        reservation.childCount === children &&
        reservation.numberOfGuests === guests
      ) {
        return reservation;
      }

      const updatedData = {
        adultCount: adults,
        childCount: children,
        numberOfGuests: guests,
      };

      const { error } = await api.updateReservationWithoutReturning(
        reservation.id,
        updatedData
      );

      if (error) {
        return reservation;
      }

      return mergeReservationUpdate(reservation, updatedData);
    })
  );

  return updated;
};

const defaultProperty: Property = {
  id: "default-property-id",
  name: "Airvik",
  address: "123 Main Street, Anytown, USA",
  phone: "555-123-4567",
  email: "contact@airvik.com",
  logo_url: "/logo-placeholder.svg",
  photos: [],
  google_maps_url: "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3022.617023443543!2d-73.98784668459395!3d40.74844097932803!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x89c259a9b3117469%3A0xd134e199a405a163!2sEmpire%20State%20Building!5e0!3m2!1sen!2sus!4v1620312953789!5m2!1sen!2sus",
  timezone: "America/New_York",
  currency: "INR",
  allowSameDayTurnover: true,
  showPartialDays: true,
  defaultUnitsView: "remaining",
  tax_enabled: false,
  tax_percentage: 0,
};

type ReservationsApiPayload = {
  data: BookingSummary[];
  nextOffset: number | null;
  count?: number | null;
};

type BookingDetailsApiPayload = {
  data: {
    reservations: Reservation[];
    guest: Guest | null;
    rooms?: Room[];
    roomTypes?: RoomType[];
    ratePlans?: RatePlan[];
  };
};

type PublicPropertyApiPayload = {
  data: Partial<Property> | null;
};

type HousekeepersApiPayload = {
  data: User[];
};

type FetchReservationsArgs = {
  limit: number;
  offset: number;
  query?: string;
  includeCount?: boolean;
};

const fetchReservationsFromApi = async (
  params: FetchReservationsArgs
): Promise<ReservationsApiPayload> => {
  const query = new URLSearchParams();
  query.set("limit", String(params.limit));
  query.set("offset", String(params.offset));
  if (params.query) {
    query.set("query", params.query);
  }
  if (params.includeCount) {
    query.set("includeCount", "1");
  }

  const response = await authorizedFetch(
    `/api/admin/reservations?${query.toString()}`,
    {
      cache: "no-store",
    }
  );

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Failed to load reservations");
  }

  return (await response.json()) as ReservationsApiPayload;
};

const fetchBookingDetailsFromApi = async (
  id: string
): Promise<BookingDetailsApiPayload> => {
  const response = await authorizedFetch(
    `/api/admin/reservations/${encodeURIComponent(id)}/booking`,
    {
      cache: "no-store",
    }
  );

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Failed to load reservation");
  }

  return (await response.json()) as BookingDetailsApiPayload;
};

const fetchPublicPropertyFromApi = async (): Promise<{
  data: Partial<Property> | null;
  error: null;
}> => {
  const response = await authorizedFetch("/api/public/property", {
    cache: "force-cache",
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Failed to load public property");
  }

  const payload = (await response.json()) as PublicPropertyApiPayload;
  return { data: payload.data ?? null, error: null };
};

const fetchHousekeepersFromApi = async (): Promise<{ data: User[] }> => {
  const response = await authorizedFetch("/api/admin/housekeepers", {
    cache: "no-store",
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Failed to load housekeepers");
  }

  const payload = (await response.json()) as HousekeepersApiPayload;
  return { data: payload.data ?? [] };
};

const getLocalDateKey = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;

const normalizeGuestText = (value?: string | null) => value?.trim() ?? "";

const createLocalGuest = (id: string, guestData: Omit<Guest, "id">): Guest => ({
  id,
  firstName: normalizeGuestText(guestData.firstName),
  lastName: normalizeGuestText(guestData.lastName),
  email: normalizeGuestText(guestData.email),
  phone: normalizeGuestText(guestData.phone),
  address: normalizeGuestText(guestData.address),
  pincode: normalizeGuestText(guestData.pincode),
  city: normalizeGuestText(guestData.city),
  state: normalizeGuestText(guestData.state),
  country: normalizeGuestText(guestData.country),
});

type RoomTypeMinimalResult = {
  id: string;
  minOccupancy?: number | null;
  maxChildren?: number | null;
  categoryId?: string | null;
};

const createLocalRoomType = (
  id: string,
  roomTypeData: Omit<RoomType, "id">,
  defaults?: RoomTypeMinimalResult | null
): RoomType => ({
  id,
  name: roomTypeData.name,
  description: roomTypeData.description,
  maxOccupancy: roomTypeData.maxOccupancy,
  minOccupancy: defaults?.minOccupancy ?? roomTypeData.minOccupancy,
  maxChildren: defaults?.maxChildren ?? roomTypeData.maxChildren,
  categoryId: defaults?.categoryId ?? roomTypeData.categoryId,
  bedTypes: roomTypeData.bedTypes,
  price: roomTypeData.price,
  amenities: roomTypeData.amenities ?? [],
  photos: roomTypeData.photos ?? [],
  mainPhotoUrl: roomTypeData.mainPhotoUrl,
  isVisible: roomTypeData.isVisible ?? true,
});

type ReservationCreateMinimalResult = {
  id: string;
  bookingId: string;
  roomId: string;
  totalAmount: number;
  bookingDate: string;
};

type ReservationCreateLocalFields = Omit<
  Reservation,
  | "id"
  | "bookingId"
  | "roomId"
  | "folio"
  | "totalAmount"
  | "bookingDate"
>;

const createLocalReservation = (
  created: ReservationCreateMinimalResult,
  fields: ReservationCreateLocalFields
): Reservation => ({
  id: created.id,
  bookingId: created.bookingId,
  roomId: created.roomId,
  folio: [],
  totalAmount: created.totalAmount,
  bookingDate: created.bookingDate,
  ...fields,
});

export function useAppData() {
  const { session, isLoading: isSessionLoading } = useSessionContext();
  const pathname = usePathname();
  const { logActivity } = useActivityLogger();
  const recordActivity = React.useCallback(
    (entry: AdminActivityLogInput) => logActivity(entry),
    [logActivity]
  );
  const formatName = (...parts: Array<string | undefined | null>) =>
    parts
      .filter((part): part is string => Boolean(part && part.trim()))
      .join(" ")
      .trim();
  const userId = session?.user?.id ?? null;
  const loadPlan = React.useMemo(
    () => getAppDataLoadPlan({ pathname, userId }),
    [pathname, userId]
  );
  const [isLoading, setIsLoading] = React.useState(true);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const hasHydratedRef = React.useRef(false);

  const [isReservationsInitialLoading, setIsReservationsInitialLoading] = React.useState(true);
  const [isBookingLookupLoading, setIsBookingLookupLoading] = React.useState(false);
  const [lookupStatus, setLookupStatus] = React.useState<Record<string, 'pending' | 'success' | 'error'>>({});
  const [activeBookingReservations, setActiveBookingReservations] = React.useState<Reservation[]>([]);
  const [activeBookingRooms, setActiveBookingRooms] = React.useState<Room[]>([]);
  const [activeBookingRoomTypes, setActiveBookingRoomTypes] = React.useState<RoomType[]>([]);
  const [activeBookingRatePlans, setActiveBookingRatePlans] = React.useState<RatePlan[]>([]);
  const [reservationsTotalCount, setReservationsTotalCount] = React.useState<number>(0);
  const [property, setProperty] = React.useState<Property>(defaultProperty);
  const [bookings, setBookings] = React.useState<BookingSummary[]>([]);
  const [reservations, setReservations] = React.useState<Reservation[]>([]);
  const [todayReservations, setTodayReservations] = React.useState<Reservation[]>([]);
  const [guests, setGuests] = React.useState<Guest[]>([]);
  const [rooms, setRooms] = React.useState<Room[]>([]);
  const [roomTypes, setRoomTypes] = React.useState<RoomType[]>([]);
  const [roomCategories, setRoomCategories] = React.useState<RoomCategory[]>([]);
  const [ratePlans, setRatePlans] = React.useState<RatePlan[]>([]);
  const [seasonalPrices, setSeasonalPrices] = React.useState<SeasonalPrice[]>([]);
  const [propertyClosures, setPropertyClosures] = React.useState<PropertyClosure[]>([]);
  const [users, setUsers] = React.useState<User[]>([]);
  const [roles, setRoles] = React.useState<Role[]>([]);
  const [amenities, setAmenities] = React.useState<Amenity[]>([]);
  const [stickyNotes, setStickyNotes] = React.useState<StickyNote[]>([]);
  const [housekeepingAssignments, setHousekeepingAssignments] = React.useState<HousekeepingAssignment[]>([]);
  const [dashboardLayout, setDashboardLayout] = React.useState<DashboardComponentId[]>(['stats', 'tables', 'calendar', 'notes']);

  const loadBookingDetails = React.useCallback(
    async (id: string) => {
      if (isSessionLoading || !userId) {
        console.log(`[Lookup] Postponing lookup for ${id}: session loading or no user`);
        setLookupStatus(prev => {
          if (prev[id]) return prev;
          return { ...prev, [id]: 'pending' };
        });
        return;
      }

      console.log(`[Lookup] Starting lookup for ID: ${id}`);
      setIsBookingLookupLoading(true);
      setLookupStatus(prev => ({ ...prev, [id]: 'pending' }));

      try {
        const { data } = await fetchBookingDetailsFromApi(id);
        const siblings = data.reservations ?? [];

        if (data.guest) {
          setGuests(prev => {
            if (prev.some(g => g.id === data.guest?.id)) return prev;
            return [...prev, data.guest!];
          });
        }

        if (siblings.length > 0) {
          console.log(`[Lookup] Successfully found ${siblings.length} records for ${id}`);
          setActiveBookingReservations(siblings);
          setActiveBookingRooms(data.rooms ?? []);
          setActiveBookingRoomTypes(data.roomTypes ?? []);
          setActiveBookingRatePlans(data.ratePlans ?? []);
          setLookupStatus(prev => ({ ...prev, [id]: 'success' }));
        } else {
          console.warn(`[Lookup] No records found for ${id}`);
          setActiveBookingReservations([]);
          setActiveBookingRooms([]);
          setActiveBookingRoomTypes([]);
          setActiveBookingRatePlans([]);
          setLookupStatus(prev => ({ ...prev, [id]: 'error' }));
        }
      } catch (error) {
        console.error(`[Lookup] Error during lookup for ${id}:`, error);
        setActiveBookingReservations([]);
        setActiveBookingRooms([]);
        setActiveBookingRoomTypes([]);
        setActiveBookingRatePlans([]);
        setLookupStatus(prev => ({ ...prev, [id]: 'error' }));
      } finally {
        setIsBookingLookupLoading(false);
      }
    },
    [userId, isSessionLoading]
  );

  const loadReservationsPage = React.useCallback(
    async (params: { limit: number; offset: number; query?: string }) => {
      setIsReservationsInitialLoading(true);
      try {
        const response = await fetchReservationsFromApi({
          limit: params.limit,
          offset: params.offset,
          query: params.query,
          includeCount: true,
        });
        const bookingsData = response.data || [];

        setBookings(bookingsData);
        setReservationsTotalCount(response.count ?? 0);
      } catch (error) {
        console.error("Failed to load reservations page:", error);
      } finally {
        setIsReservationsInitialLoading(false);
      }
    },
    []
  );

  const fetchData = React.useCallback(async (options?: { keepExisting?: boolean }) => {
    if (isSessionLoading) {
      console.log("[AppData] Postponing fetchData: session still loading");
      return;
    }

    const keepExisting = options?.keepExisting ?? false;
    const alreadyHydrated = hasHydratedRef.current;
    const shouldUseLoadingState = !alreadyHydrated || !keepExisting;
    const normalizedPathname =
      pathname && pathname.length > 1 && pathname.endsWith("/")
        ? pathname.slice(0, -1)
        : pathname ?? "/";
    const isReservationDetailLookupRoute =
      normalizedPathname.startsWith("/admin/reservations/") &&
      normalizedPathname !== "/admin/reservations/new" &&
      !normalizedPathname.endsWith("/edit");

    if (shouldUseLoadingState) {
      setIsLoading(true);
      setIsReservationsInitialLoading(true);
    } else {
      setIsRefreshing(true);
    }

    try {
      if (loadPlan.mode === "none") {
        console.log(`[AppData] Skipping global data for route ${pathname ?? "/"}`);
        setGuests([]);
        setRooms([]);
        setRatePlans([]);
        setSeasonalPrices([]);
        setPropertyClosures([]);
        setRoles([]);
        setAmenities([]);
        setStickyNotes([]);
        setUsers([]);
        setHousekeepingAssignments([]);
        setBookings([]);
        setReservations([]);
        setActiveBookingReservations([]);
        setActiveBookingRooms([]);
        setActiveBookingRoomTypes([]);
        setActiveBookingRatePlans([]);
        setTodayReservations([]);
        setReservationsTotalCount(0);
        setRoomTypes([]);
        setRoomCategories([]);
        if (!alreadyHydrated) {
          hasHydratedRef.current = true;
        }
        return;
      }

      const canLoad = (dataset: Parameters<typeof isAppDataDatasetEnabled>[1]) =>
        isAppDataDatasetEnabled(loadPlan, dataset);

      console.log(
        `[AppData] Fetching ${loadPlan.mode} data (userId: ${userId ?? "none"})`
      );
      const todayDate = getLocalDateKey();
      const [
        propertyRes, guestsRes, roomsRes, roomTypesRes, roomCategoriesRes, ratePlansRes,
        seasonalPricesRes, propertyClosuresRes,
        rolesRes, amenitiesRes, usersFuncRes, housekeepingAssignmentsRes,
        roomTypeAmenitiesRes,
        dashboardReservationsRes
      ] = await Promise.all([
        canLoad("property")
          ? loadPlan.mode === "admin"
            ? api.getProperty()
            : fetchPublicPropertyFromApi()
          : Promise.resolve({ data: null, error: null }),
        canLoad("guests") ? api.getGuests() : Promise.resolve({ data: [] }),
        canLoad("rooms") ? api.getRooms() : Promise.resolve({ data: [] }),
        canLoad("roomTypes") ? api.getRoomTypes() : Promise.resolve({ data: [] }),
        canLoad("roomCategories")
          ? api.getRoomCategories()
          : Promise.resolve({ data: [] }),
        canLoad("ratePlans") ? api.getRatePlans() : Promise.resolve({ data: [] }),
        canLoad("seasonalPrices")
          ? api.getSeasonalPrices()
          : Promise.resolve({ data: [] }),
        canLoad("propertyClosures")
          ? api
              .getPropertyClosures()
              .then(data => ({ data }))
              .catch(() => ({ data: [] as PropertyClosure[] }))
          : Promise.resolve({ data: [] as PropertyClosure[] }),
        canLoad("roles") ? api.getRoles() : Promise.resolve({ data: [] }),
        canLoad("amenities") ? api.getAmenities() : Promise.resolve({ data: [] }),
        canLoad("users")
          ? api.getUsers()
          : canLoad("housekeepers")
            ? fetchHousekeepersFromApi()
            : Promise.resolve({ data: [] }),
        canLoad("housekeepingAssignments")
          ? api.getHousekeepingAssignments(todayDate)
          : Promise.resolve({ data: [] }),
        canLoad("roomTypeAmenities")
          ? api.getRoomTypeAmenities()
          : Promise.resolve({ data: [] }),
        canLoad("dashboardReservations")
          ? fetchReservationsFromApi({ limit: 1000, offset: 0, includeCount: true })
          : Promise.resolve({ data: [], nextOffset: null, count: 0 } as ReservationsApiPayload)
      ]);

      const roomTypeAmenities = (roomTypeAmenitiesRes.data || []) as RoomTypeAmenityRecord[];
      const roomTypesData = (roomTypesRes.data || []).map(rt => {
        const amenitiesForRoomType = roomTypeAmenities
          .filter(rta => rta.room_type_id === rt.id)
          .map(rta => rta.amenity_id);
        return api.fromDbRoomType({ ...rt, amenities: amenitiesForRoomType });
      });

      if (loadPlan.mode !== "admin") {
        console.log(`[AppData] Applied ${loadPlan.mode} public data plan`);
        if (propertyRes.data) setProperty({ ...defaultProperty, ...propertyRes.data });
        setGuests([]);
        setRooms(canLoad("rooms") ? roomsRes.data || [] : []);
        setRatePlans(canLoad("ratePlans") ? ratePlansRes.data || [] : []);
        setSeasonalPrices(canLoad("seasonalPrices") ? seasonalPricesRes.data || [] : []);
        setPropertyClosures(canLoad("propertyClosures") ? propertyClosuresRes.data || [] : []);
        setRoles([]);
        setAmenities(canLoad("amenities") ? amenitiesRes.data || [] : []);
        setStickyNotes([]);
        setUsers([]);
        setHousekeepingAssignments([]);
        setBookings([]);
        setReservations([]);
        setActiveBookingReservations([]);
        setActiveBookingRooms([]);
        setActiveBookingRoomTypes([]);
        setActiveBookingRatePlans([]);
        setTodayReservations([]);
        setReservationsTotalCount(0);
        setIsReservationsInitialLoading(false);
        setRoomTypes(canLoad("roomTypes") ? roomTypesData : []);
        setRoomCategories([]);
        if (!alreadyHydrated) {
          hasHydratedRef.current = true;
        }
        return;
      }

      if (propertyRes.data) setProperty({ ...defaultProperty, ...propertyRes.data });
      setGuests(guestsRes.data || []);
      setRooms(roomsRes.data || []);
      setRatePlans(ratePlansRes.data || []);
      setSeasonalPrices(seasonalPricesRes.data || []);
      setPropertyClosures(propertyClosuresRes.data || []);
      setRoles((rolesRes.data || []).map(mapDbRole));
      setAmenities(amenitiesRes.data || []);
      setUsers(usersFuncRes.data || []);
      setHousekeepingAssignments(housekeepingAssignmentsRes.data || []);

      const bookingsData = dashboardReservationsRes.data ?? [];
      const flatReservations = bookingsData.flatMap(b => b.subRows || []);

      setTodayReservations(sortReservationsByBookingDate(flatReservations));
      setReservations(sortReservationsByBookingDate(flatReservations));
      if (!isReservationDetailLookupRoute) {
        setActiveBookingReservations([]);
        setActiveBookingRooms([]);
        setActiveBookingRoomTypes([]);
        setActiveBookingRatePlans([]);
      }
      setReservationsTotalCount(dashboardReservationsRes.count ?? 0);
      setIsReservationsInitialLoading(false);

      setRoomTypes(roomTypesData);
      setRoomCategories(roomCategoriesRes.data || []);

      if (!alreadyHydrated) {
        hasHydratedRef.current = true;
      }
      console.log("[AppData] Global data fetch complete");
    } catch (error) {
      console.error("[AppData] Failed to load app data:", error);
    } finally {
      if (shouldUseLoadingState) {
        setIsLoading(false);
      } else {
        setIsRefreshing(false);
      }
      setIsReservationsInitialLoading(false);
    }
  }, [loadPlan, pathname, userId, isSessionLoading]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  const refreshReservations = React.useCallback(() => fetchData({ keepExisting: true }), [fetchData]);

  const triggerReservationsCacheRevalidation = React.useCallback(() => {
    void revalidateReservationsCache();
  }, []);

  const updateProperty = async (updatedData: Partial<Omit<Property, "id">>) => {
    const changedFields = extractChangedFields(property, updatedData);
    if (property.id !== "default-property-id") {
      const updatedProperty: Property = { ...property, ...updatedData };
      const { error } = await api.updatePropertyWithoutReturning(
        property.id,
        updatedData,
      );
      if (error) throw error;
      setProperty({ ...defaultProperty, ...updatedProperty });
      recordActivity({
        section: "property",
        entityType: "property",
        entityId: updatedProperty.id,
        entityLabel: updatedProperty.name,
        action: "property_updated",
        details: "Updated property settings",
        metadata: changedFields.length ? { changedFields } : undefined,
      });
      return;
    }

    const { data, error } = await api.createPropertyIdAndDefaults(updatedData);
    if (error || !data) {
      throw error ?? new Error("Failed to create property.");
    }
    const createdProperty: Property = {
      ...defaultProperty,
      ...updatedData,
      ...data,
    };
    setProperty(createdProperty);
    recordActivity({
      section: "property",
      entityType: "property",
      entityId: createdProperty.id,
      entityLabel: createdProperty.name,
      action: property.id === "default-property-id" ? "property_created" : "property_updated",
      details: property.id === "default-property-id"
        ? "Created property configuration"
        : "Updated property settings",
      metadata: changedFields.length ? { changedFields } : undefined,
    });
  };

  const addGuest = async (guestData: Omit<Guest, "id">) => {
    const { data: guestId, error } = await api.addGuestIdOnly(guestData);
    if (error || !guestId) {
      throw error ?? new Error("Failed to create guest");
    }
    const createdGuest = createLocalGuest(guestId, guestData);
    setGuests(prev => [...prev, createdGuest]);
    const label = formatName(createdGuest.firstName, createdGuest.lastName) || createdGuest.email;
    recordActivity({
      section: "guests",
      entityType: "guest",
      entityId: createdGuest.id,
      entityLabel: label,
      action: "guest_created",
      details: `Added guest ${label}`,
      metadata: { email: createdGuest.email, phone: createdGuest.phone },
    });
    return createdGuest;
  };

  const updateGuest = async (
    guestId: string,
    updatedData: Partial<Omit<Guest, "id">>,
    existingGuest?: Guest
  ) => {
    const previousGuest = existingGuest ?? guests.find((g) => g.id === guestId);
    if (previousGuest) {
      const updatedGuest: Guest = { ...previousGuest, ...updatedData };
      const { error } = await api.updateGuestWithoutReturning(
        guestId,
        updatedData,
      );
      if (error) throw error;
      setGuests(prev => prev.map(g => g.id === guestId ? updatedGuest : g));
      const label = formatName(updatedGuest.firstName, updatedGuest.lastName) || updatedGuest.email;
      const changedFields = extractChangedFields(previousGuest, updatedData);
      recordActivity({
        section: "guests",
        entityType: "guest",
        entityId: guestId,
        entityLabel: label,
        action: "guest_updated",
        details: `Updated guest ${label}`,
        metadata: changedFields.length ? { changedFields } : undefined,
      });
      return;
    }

    const { error } = await api.updateGuestWithoutReturning(guestId, updatedData);
    if (error) throw error;
    const label =
      formatName(updatedData.firstName, updatedData.lastName) ||
      updatedData.email ||
      guestId;
    const changedFields = extractChangedFields(undefined, updatedData);
    recordActivity({
      section: "guests",
      entityType: "guest",
      entityId: guestId,
      entityLabel: label,
      action: "guest_updated",
      details: `Updated guest ${label}`,
      metadata: changedFields.length ? { changedFields } : undefined,
    });
  };

  const deleteGuest = async (guestId: string) => {
    const guest = guests.find((g) => g.id === guestId);
    const { error } = await api.deleteGuest(guestId);
    if (error) { console.error(error); return false; }
    setGuests(prev => prev.filter(g => g.id !== guestId));
    if (guest) {
      const label = formatName(guest.firstName, guest.lastName) || guest.email;
      recordActivity({
        section: "guests",
        entityType: "guest",
        entityId: guest.id,
        entityLabel: label,
        action: "guest_deleted",
        details: `Deleted guest ${label}`,
      });
    }
    return true;
  };

  const addReservation = async (payload: CreateReservationPayload) => {
    const { roomIds, roomOccupancies, customRoomTotals, ...reservationDetails } = payload;

    // Check if rate plan exists, but don't fail if it doesn't
    const ratePlan = reservationDetails.ratePlanId
      ? ratePlans.find((rp) => rp.id === reservationDetails.ratePlanId)
      : null;

    if (reservationDetails.ratePlanId && !ratePlan) {
      console.warn(`Rate plan with id ${reservationDetails.ratePlanId} not found, proceeding with room type pricing`);
    }

    const taxEnabled = Boolean(property?.tax_enabled);
    const taxRate = property?.tax_percentage ?? 0;

    const { data, error } = await api.createReservationsWithTotalMinimal({
      p_booking_id: null,
      p_guest_id: reservationDetails.guestId,
      p_room_ids: roomIds,
      p_rate_plan_id: reservationDetails.ratePlanId || "default-rate-plan",
      p_check_in_date: reservationDetails.checkInDate,
      p_check_out_date: reservationDetails.checkOutDate,
      p_number_of_guests: reservationDetails.numberOfGuests,
      p_status: reservationDetails.status,
      p_notes: reservationDetails.notes ?? null,
      p_booking_date: reservationDetails.bookingDate,
      p_source: reservationDetails.source,
      p_payment_method: reservationDetails.paymentMethod,
      p_adult_count: reservationDetails.adultCount,
      p_child_count: reservationDetails.childCount,
      p_tax_enabled_snapshot: taxEnabled,
      p_tax_rate_snapshot: taxEnabled ? taxRate : 0,
      p_custom_totals: customRoomTotals ?? null,
    });

    if (error) throw error;

    const createdReservations = data.map((createdReservation) =>
      createLocalReservation(createdReservation, {
        guestId: reservationDetails.guestId,
        ratePlanId: reservationDetails.ratePlanId || "default-rate-plan",
        checkInDate: reservationDetails.checkInDate,
        checkOutDate: reservationDetails.checkOutDate,
        numberOfGuests: reservationDetails.numberOfGuests,
        status: reservationDetails.status,
        notes: reservationDetails.notes,
        source: reservationDetails.source,
        paymentMethod: reservationDetails.paymentMethod,
        adultCount: reservationDetails.adultCount,
        childCount: reservationDetails.childCount,
        taxEnabledSnapshot: taxEnabled,
        taxRateSnapshot: taxEnabled ? taxRate : 0,
      })
    );

    const normalizedOccupancies = normalizeRoomOccupancies(
      roomIds,
      reservationDetails.adultCount,
      reservationDetails.childCount,
      roomOccupancies
    );

    let reservationsWithEmptyFolio: Reservation[] = createdReservations;
    reservationsWithEmptyFolio = await applyRoomOccupancyAssignments(
      reservationsWithEmptyFolio,
      normalizedOccupancies
    );

    setReservations((prev) =>
      sortReservationsByBookingDate([...prev, ...reservationsWithEmptyFolio])
    );
    triggerReservationsCacheRevalidation();
    const primaryReservation = reservationsWithEmptyFolio[0];
    const assignedBookingId = primaryReservation?.bookingId ?? null;
    const guest = guests.find((g) => g.id === reservationDetails.guestId);
    const label = guest
      ? formatName(guest.firstName, guest.lastName) || guest.email
      : reservationDetails.guestId;
    recordActivity({
      section: "reservations",
      entityType: "reservation",
      entityId: primaryReservation?.id ?? null,
      entityLabel: assignedBookingId,
      action: "reservation_created",
      details: `Created reservation for ${label}`,
      metadata: {
        roomIds,
        status: reservationDetails.status,
        guestId: reservationDetails.guestId,
      },
    });
    return reservationsWithEmptyFolio;
  };

  const addRoomsToBooking = async (payload: AddRoomsToBookingPayload) => {
    if (!payload.roomIds.length) {
      return [];
    }

    const { roomOccupancies } = payload;

    const { data, error } = await api.createReservationsWithTotalMinimal({
      p_booking_id: payload.bookingId,
      p_guest_id: payload.guestId,
      p_room_ids: payload.roomIds,
      p_rate_plan_id: payload.ratePlanId || "default-rate-plan",
      p_check_in_date: payload.checkInDate,
      p_check_out_date: payload.checkOutDate,
      p_number_of_guests: payload.numberOfGuests,
      p_status: payload.status,
      p_notes: payload.notes ?? null,
      p_booking_date: payload.bookingDate,
      p_source: payload.source,
      p_payment_method: payload.paymentMethod,
      p_adult_count: payload.adultCount,
      p_child_count: payload.childCount,
      p_tax_enabled_snapshot: payload.taxEnabledSnapshot,
      p_tax_rate_snapshot: payload.taxRateSnapshot,
      p_custom_totals: payload.customRoomTotals ?? null,
    });

    if (error) throw error;

    const createdFromMinimal = data.map((createdReservation) =>
      createLocalReservation(createdReservation, {
        guestId: payload.guestId,
        ratePlanId: payload.ratePlanId || "default-rate-plan",
        checkInDate: payload.checkInDate,
        checkOutDate: payload.checkOutDate,
        numberOfGuests: payload.numberOfGuests,
        status: payload.status,
        notes: payload.notes,
        source: payload.source,
        paymentMethod: payload.paymentMethod,
        adultCount: payload.adultCount,
        childCount: payload.childCount,
        taxEnabledSnapshot: payload.taxEnabledSnapshot,
        taxRateSnapshot: payload.taxRateSnapshot,
      })
    );

    const normalizedOccupancies = normalizeRoomOccupancies(
      payload.roomIds,
      payload.adultCount,
      payload.childCount,
      roomOccupancies
    );

    let createdReservations: Reservation[] = createdFromMinimal;

    createdReservations = await applyRoomOccupancyAssignments(
      createdReservations,
      normalizedOccupancies
    );

    setReservations((prev) =>
      sortReservationsByBookingDate([...(prev ?? []), ...createdReservations])
    );
    triggerReservationsCacheRevalidation();

    return createdReservations;
  };

  const updateReservation = async (reservationId: string, updatedData: Partial<Omit<Reservation, "id">>) => {
    const previousReservation =
      reservations.find((reservation) => reservation.id === reservationId) ??
      activeBookingReservations.find((reservation) => reservation.id === reservationId);
    const updateForState = definedReservationUpdate(updatedData);

    if (previousReservation) {
      const { error } = await api.updateReservationWithoutReturning(
        reservationId,
        updatedData
      );
      if (error) throw error;

      const updatedReservation = mergeReservationUpdate(previousReservation, updatedData);
      const mergeIntoReservations = (prev: Reservation[]) =>
        prev.map((reservation) =>
          reservation.id === reservationId
            ? mergeReservationUpdate(reservation, updatedData)
            : reservation
        );
      setReservations(mergeIntoReservations);
      setActiveBookingReservations(mergeIntoReservations);
      triggerReservationsCacheRevalidation();
      const changedFields = extractChangedFields(previousReservation, updateForState);
      recordActivity({
        section: "reservations",
        entityType: "reservation",
        entityId: reservationId,
        entityLabel: updatedReservation.bookingId,
        action: "reservation_updated",
        details: `Updated reservation ${updatedReservation.bookingId}`,
        metadata: changedFields.length ? { changedFields } : undefined,
      });
      return;
    }

    const { error } = await api.updateReservationWithoutReturning(
      reservationId,
      updatedData
    );
    if (error) throw error;
    triggerReservationsCacheRevalidation();
    const reservationLabel = updatedData.bookingId || reservationId;
    const changedFields = extractChangedFields(undefined, updateForState);
    recordActivity({
      section: "reservations",
      entityType: "reservation",
      entityId: reservationId,
      entityLabel: reservationLabel,
      action: "reservation_updated",
      details: `Updated reservation ${reservationLabel}`,
      metadata: changedFields.length ? { changedFields } : undefined,
    });
  };

  const updateReservationStatus = async (reservationId: string, status: ReservationStatus) => {
    const { error } = await api.updateReservationStatus(reservationId, status);
    if (error) throw error;
    setReservations(prev => prev.map(r => r.id === reservationId ? { ...r, status } : r));
    triggerReservationsCacheRevalidation();
    recordActivity({
      section: "reservations",
      entityType: "reservation",
      entityId: reservationId,
      entityLabel: reservationId,
      action: "reservation_status_updated",
      details: `Changed reservation status to ${status}`,
      metadata: { status },
    });
  };

  const updateBookingReservationStatus = async (
    bookingId: string,
    status: ReservationStatus
  ) => {
    const knownReservationsById = new Map<string, Reservation>();
    reservations.forEach((reservation) => {
      if (reservation.bookingId === bookingId) {
        knownReservationsById.set(reservation.id, reservation);
      }
    });
    activeBookingReservations.forEach((reservation) => {
      if (reservation.bookingId === bookingId) {
        knownReservationsById.set(reservation.id, reservation);
      }
    });
    bookings.forEach((booking) => {
      booking.subRows?.forEach((reservation) => {
        if (reservation.bookingId === bookingId) {
          knownReservationsById.set(reservation.id, reservation);
        }
      });
    });

    const knownReservations = Array.from(knownReservationsById.values());

    if (knownReservations.length > 0) {
      const { error } = await api.updateBookingReservationsStatusWithoutReturning(
        bookingId,
        status
      );
      if (error) throw error;

      const affectedIds = new Set(knownReservations.map((reservation) => reservation.id));
      const withUpdatedStatus = <T extends Reservation>(reservation: T): T =>
        affectedIds.has(reservation.id) ? { ...reservation, status } : reservation;

      setReservations((prev) => prev.map(withUpdatedStatus));
      setActiveBookingReservations((prev) => prev.map(withUpdatedStatus));
      setTodayReservations((prev) => prev.map(withUpdatedStatus));
      setBookings((prev) =>
        prev.map((booking) =>
          booking.bookingId === bookingId
            ? {
              ...booking,
              status,
              subRows: booking.subRows.map(withUpdatedStatus),
            }
            : booking
        )
      );
      triggerReservationsCacheRevalidation();

      knownReservations.forEach((reservation) => {
        const updatedReservation = { ...reservation, status };
        recordActivity({
          section: "reservations",
          entityType: "reservation",
          entityId: updatedReservation.id,
          entityLabel: updatedReservation.bookingId,
          action: "reservation_status_updated",
          details: `Changed reservation status to ${status}`,
          metadata: {
            status,
            bookingId,
            roomId: updatedReservation.roomId,
          },
        });
      });

      recordActivity({
        section: "reservations",
        entityType: "reservation",
        entityId: bookingId,
        entityLabel: bookingId,
        action: "reservation_status_updated",
        details: `Changed booking ${bookingId} status to ${status} for ${knownReservations.length} rooms`,
        metadata: { status, bookingId, affectedReservations: knownReservations.length },
      });
      return;
    }

    const { count, error } = await api.updateBookingReservationsStatusWithoutReturning(
      bookingId,
      status
    );
    if (error) throw error;
    const affectedReservations = count ?? 0;
    if (!affectedReservations) {
      return;
    }
    triggerReservationsCacheRevalidation();

    recordActivity({
      section: "reservations",
      entityType: "reservation",
      entityId: bookingId,
      entityLabel: bookingId,
      action: "reservation_status_updated",
      details: `Changed booking ${bookingId} status to ${status} for ${affectedReservations} rooms`,
      metadata: { status, bookingId, affectedReservations },
    });
  };

  const addFolioItem = async (
    reservationId: string,
    item: Omit<FolioItem, "id" | "timestamp">
  ) => {
    const { data: inserted, error } = await api.addFolioItemIdAndTimestamp({
      reservation_id: reservationId,
      description: item.description,
      amount: item.amount,
      payment_method: item.paymentMethod ?? null,
      transaction_id: item.transactionId ?? null,
      external_source: item.externalSource ?? undefined,
      external_reference: item.externalReference ?? null,
      external_metadata: item.externalMetadata ?? undefined,
    });
    if (error || !inserted?.id) {
      if (error && typeof error === "object" && "message" in error) {
        throw new Error(String((error as { message?: string }).message || "Failed to add folio item"));
      }
      throw new Error("Failed to add folio item");
    }
    const folioItem: FolioItem = {
      id: inserted.id,
      description: item.description,
      amount: item.amount,
      timestamp: inserted.timestamp ?? new Date().toISOString(),
      paymentMethod: item.paymentMethod ?? undefined,
      transactionId: item.transactionId ?? undefined,
      externalSource: item.externalSource ?? "internal",
      externalReference: item.externalReference ?? undefined,
      externalMetadata: item.externalMetadata ?? {},
    };
    setReservations(prev =>
      prev.map(r =>
        r.id === reservationId
          ? { ...r, folio: [...(r.folio || []), folioItem] }
          : r
      )
    );
    setBookings(prev =>
      prev.map(b => {
        const hasReservation = b.subRows?.some(sr => sr.id === reservationId);
        if (!hasReservation) return b;
        return {
          ...b,
          subRows: b.subRows.map(sr =>
            sr.id === reservationId
              ? { ...sr, folio: [...(sr.folio || []), folioItem] }
              : sr
          ),
        };
      })
    );
    setActiveBookingReservations(prev =>
      prev.map(r =>
        r.id === reservationId
          ? { ...r, folio: [...(r.folio || []), folioItem] }
          : r
      )
    );
    triggerReservationsCacheRevalidation();
    recordActivity({
      section: "reservations",
      entityType: "reservation",
      entityId: reservationId,
      entityLabel: reservationId,
      action: item.amount >= 0 ? "reservation_charge_added" : "reservation_payment_recorded",
      details:
        item.amount >= 0
          ? `Added charge ${item.description}`
          : `Recorded payment ${item.description}`,
      amountMinor: Math.round(item.amount * 100),
      metadata: {
        description: item.description,
        paymentMethod: item.paymentMethod,
      },
    });
  };

  const addRoomType = async (roomTypeData: Omit<RoomType, "id">) => {
    const payload = {
      ...roomTypeData,
      isVisible: roomTypeData.isVisible ?? true,
    };
    const { data, error } = await api.upsertRoomTypeMinimal(payload);
    if (error || !data?.id) {
      throw error ?? new Error("Failed to create room type.");
    }
    const newRoomType = createLocalRoomType(data.id, payload, data);
    setRoomTypes(prev => [...prev, newRoomType]);
    recordActivity({
      section: "room_types",
      entityType: "room_type",
      entityId: newRoomType.id,
      entityLabel: newRoomType.name,
      action: "room_type_created",
      details: `Created room type ${newRoomType.name}`,
    });
  };

  const updateRoomType = async (
    roomTypeId: string,
    updatedData: Partial<Omit<RoomType, "id">>,
    localRoomType?: RoomType
  ) => {
    const existingRoomType =
      localRoomType ?? roomTypes.find((roomType) => roomType.id === roomTypeId);
    if (!existingRoomType) {
      throw new Error("Room type not found.");
    }

    const payload = {
      id: roomTypeId,
      name: updatedData.name ?? existingRoomType.name,
      description: updatedData.description ?? existingRoomType.description,
      maxOccupancy: updatedData.maxOccupancy ?? existingRoomType.maxOccupancy,
      minOccupancy: updatedData.minOccupancy ?? existingRoomType.minOccupancy,
      maxChildren: updatedData.maxChildren ?? existingRoomType.maxChildren,
      categoryId: updatedData.categoryId ?? existingRoomType.categoryId,
      bedTypes: updatedData.bedTypes ?? existingRoomType.bedTypes,
      price: updatedData.price ?? existingRoomType.price,
      photos: updatedData.photos ?? existingRoomType.photos,
      mainPhotoUrl: updatedData.mainPhotoUrl ?? existingRoomType.mainPhotoUrl,
      amenities: updatedData.amenities ?? existingRoomType.amenities,
      isVisible:
        typeof updatedData.isVisible === "boolean"
          ? updatedData.isVisible
          : existingRoomType.isVisible,
    };

    const { data, error } = await api.upsertRoomTypeMinimal(payload);
    if (error || !data?.id) {
      throw error ?? new Error("Failed to update room type.");
    }
    const updatedRoomType = createLocalRoomType(data.id, payload, data);
    setRoomTypes(prev => prev.map(rt => rt.id === roomTypeId ? updatedRoomType : rt));
    const changedFields = extractChangedFields(existingRoomType, updatedData);
    recordActivity({
      section: "room_types",
      entityType: "room_type",
      entityId: roomTypeId,
      entityLabel: updatedRoomType.name,
      action: "room_type_updated",
      details: `Updated room type ${updatedRoomType.name}`,
      metadata: changedFields.length ? { changedFields } : undefined,
    });
  };

  const addRoom = async (roomData: Omit<Room, "id">) => {
    const { data: roomId, error } = await api.addRoomIdOnly(roomData);
    if (error || !roomId) {
      throw error ?? new Error("Failed to create room");
    }
    const newRoom: Room = {
      id: roomId,
      ...roomData,
    };
    setRooms(prev => [...prev, newRoom]);
    recordActivity({
      section: "rooms",
      entityType: "room",
      entityId: newRoom.id,
      entityLabel: newRoom.roomNumber,
      action: "room_created",
      details: `Created room ${newRoom.roomNumber}`,
      metadata: { roomTypeId: newRoom.roomTypeId },
    });
  };

  const updateRoom = async (
    roomId: string,
    updatedData: Partial<Omit<Room, "id">>,
    existingRoom?: Room
  ) => {
    const previousRoom = existingRoom ?? rooms.find((room) => room.id === roomId);
    if (previousRoom) {
      const updatedRoom: Room = { ...previousRoom, ...updatedData };
      const { error } = await api.updateRoomWithoutReturning(roomId, updatedData);
      if (error) throw error;
      setRooms(prev => prev.map(r => r.id === roomId ? updatedRoom : r));
      const changedFields = extractChangedFields(previousRoom, updatedData);
      recordActivity({
        section: "rooms",
        entityType: "room",
        entityId: roomId,
        entityLabel: updatedRoom.roomNumber,
        action: "room_updated",
        details: `Updated room ${updatedRoom.roomNumber}`,
        metadata: changedFields.length ? { changedFields } : undefined,
      });
      return;
    }

    const { error } = await api.updateRoomWithoutReturning(roomId, updatedData);
    if (error) throw error;
    const label = updatedData.roomNumber ?? roomId;
    const changedFields = extractChangedFields(undefined, updatedData);
    recordActivity({
      section: "rooms",
      entityType: "room",
      entityId: roomId,
      entityLabel: label,
      action: "room_updated",
      details: `Updated room ${label}`,
      metadata: changedFields.length ? { changedFields } : undefined,
    });
  };

  const deleteRoom = async (roomId: string, existingRoom?: Room) => {
    const room = existingRoom ?? rooms.find((r) => r.id === roomId);
    const { error } = await api.deleteRoom(roomId);
    if (error) { console.error(error); return false; }
    setRooms(prev => prev.filter(r => r.id !== roomId));
    if (room) {
      recordActivity({
        section: "rooms",
        entityType: "room",
        entityId: room.id,
        entityLabel: room.roomNumber,
        action: "room_deleted",
        details: `Deleted room ${room.roomNumber}`,
      });
    }
    return true;
  };

  const deleteRoomType = async (
    roomTypeId: string,
    localRoomType?: RoomType
  ) => {
    const roomType = localRoomType ?? roomTypes.find((rt) => rt.id === roomTypeId);
    const { error } = await api.deleteRoomType(roomTypeId);
    if (error) { console.error(error); return false; }
    setRoomTypes(prev => prev.filter(rt => rt.id !== roomTypeId));
    if (roomType) {
      recordActivity({
        section: "room_types",
        entityType: "room_type",
        entityId: roomType.id,
        entityLabel: roomType.name,
        action: "room_type_deleted",
        details: `Deleted room type ${roomType.name}`,
      });
    }
    return true;
  };

  const addRoomCategory = async (roomCategoryData: Omit<RoomCategory, "id">): Promise<void> => {
    const { data: roomCategoryId, error } = await api.addRoomCategoryIdOnly(roomCategoryData);
    if (error || !roomCategoryId) {
      throw error ?? new Error("Failed to create room category");
    }
    const createdCategory: RoomCategory = {
      id: roomCategoryId,
      ...roomCategoryData,
    };
    setRoomCategories(prev => [...prev, createdCategory]);
    recordActivity({
      section: "room_categories",
      entityType: "room_category",
      entityId: createdCategory.id,
      entityLabel: createdCategory.name,
      action: "room_category_created",
      details: `Created room category ${createdCategory.name}`,
    });
  };

  const updateRoomCategory = async (
    roomCategoryId: string,
    updatedData: Partial<Omit<RoomCategory, "id">>,
    existingCategory?: RoomCategory
  ): Promise<void> => {
    const previousRoomCategory =
      existingCategory ?? roomCategories.find((rc) => rc.id === roomCategoryId);
    if (previousRoomCategory) {
      const updatedRoomCategory: RoomCategory = {
        ...previousRoomCategory,
        ...updatedData,
      };
      const { error } = await api.updateRoomCategoryWithoutReturning(
        roomCategoryId,
        updatedData,
      );
      if (error) throw error;
      setRoomCategories(prev =>
        prev.map(rc => rc.id === roomCategoryId ? updatedRoomCategory : rc)
      );
      const changedFields = extractChangedFields(previousRoomCategory, updatedData);
      recordActivity({
        section: "room_categories",
        entityType: "room_category",
        entityId: roomCategoryId,
        entityLabel: updatedRoomCategory.name,
        action: "room_category_updated",
        details: `Updated room category ${updatedRoomCategory.name}`,
        metadata: changedFields.length ? { changedFields } : undefined,
      });
      return;
    }

    const { error } = await api.updateRoomCategoryWithoutReturning(
      roomCategoryId,
      updatedData,
    );
    if (error) throw error;
    const label = updatedData.name ?? roomCategoryId;
    const changedFields = extractChangedFields(undefined, updatedData);
    recordActivity({
      section: "room_categories",
      entityType: "room_category",
      entityId: roomCategoryId,
      entityLabel: label,
      action: "room_category_updated",
      details: `Updated room category ${label}`,
      metadata: changedFields.length ? { changedFields } : undefined,
    });
  };

  const deleteRoomCategory = async (
    roomCategoryId: string,
    existingCategory?: RoomCategory
  ): Promise<boolean> => {
    const roomCategory =
      existingCategory ?? roomCategories.find((rc) => rc.id === roomCategoryId);
    const { error } = await api.deleteRoomCategory(roomCategoryId);
    if (error) { console.error(error); return false; }
    setRoomCategories(prev => prev.filter(rc => rc.id !== roomCategoryId));
    if (roomCategory) {
      recordActivity({
        section: "room_categories",
        entityType: "room_category",
        entityId: roomCategory.id,
        entityLabel: roomCategory.name,
        action: "room_category_deleted",
        details: `Deleted room category ${roomCategory.name}`,
      });
    }
    return true;
  };

  const addRatePlan = async (ratePlanData: Omit<RatePlan, "id">) => {
    const { data: ratePlanId, error } = await api.addRatePlanIdOnly(ratePlanData);
    if (error || !ratePlanId) {
      throw error ?? new Error("Failed to create rate plan");
    }
    const createdRatePlan: RatePlan = {
      id: ratePlanId,
      ...ratePlanData,
    };
    setRatePlans(prev => [...prev, createdRatePlan]);
    recordActivity({
      section: "rate_plans",
      entityType: "rate_plan",
      entityId: createdRatePlan.id,
      entityLabel: createdRatePlan.name,
      action: "rate_plan_created",
      details: `Created rate plan ${createdRatePlan.name}`,
    });
  };

  const updateRatePlan = async (
    ratePlanId: string,
    updatedData: Partial<Omit<RatePlan, "id">>,
    existingRatePlan?: RatePlan
  ) => {
    const previousRatePlan =
      existingRatePlan ?? ratePlans.find((rp) => rp.id === ratePlanId);
    if (previousRatePlan) {
      const updatedRatePlan: RatePlan = { ...previousRatePlan, ...updatedData };
      const { error } = await api.updateRatePlanWithoutReturning(ratePlanId, updatedData);
      if (error) throw error;
      setRatePlans(prev => prev.map(rp => rp.id === ratePlanId ? updatedRatePlan : rp));
      const changedFields = extractChangedFields(previousRatePlan, updatedData);
      recordActivity({
        section: "rate_plans",
        entityType: "rate_plan",
        entityId: ratePlanId,
        entityLabel: updatedRatePlan.name,
        action: "rate_plan_updated",
        details: `Updated rate plan ${updatedRatePlan.name}`,
        metadata: changedFields.length ? { changedFields } : undefined,
      });
      return;
    }

    const { error } = await api.updateRatePlanWithoutReturning(ratePlanId, updatedData);
    if (error) throw error;
    const label = updatedData.name ?? ratePlanId;
    const changedFields = extractChangedFields(undefined, updatedData);
    recordActivity({
      section: "rate_plans",
      entityType: "rate_plan",
      entityId: ratePlanId,
      entityLabel: label,
      action: "rate_plan_updated",
      details: `Updated rate plan ${label}`,
      metadata: changedFields.length ? { changedFields } : undefined,
    });
  };

  const deleteRatePlan = async (
    ratePlanId: string,
    existingRatePlan?: RatePlan
  ) => {
    const ratePlan = existingRatePlan ?? ratePlans.find((rp) => rp.id === ratePlanId);
    const { error } = await api.deleteRatePlan(ratePlanId);
    if (error) { console.error(error); return false; }
    setRatePlans(prev => prev.filter(rp => rp.id !== ratePlanId));
    if (ratePlan) {
      recordActivity({
        section: "rate_plans",
        entityType: "rate_plan",
        entityId: ratePlan.id,
        entityLabel: ratePlan.name,
        action: "rate_plan_deleted",
        details: `Deleted rate plan ${ratePlan.name}`,
      });
    }
    return true;
  };

  const addSeasonalPrice = async (
    data: Omit<SeasonalPrice, "id">,
    roomTypeName?: string
  ) => {
    const { data: seasonalPriceId, error } = await api.addSeasonalPriceIdOnly(data);
    if (error || !seasonalPriceId) {
      throw error ?? new Error("Failed to create seasonal price");
    }
    const created: SeasonalPrice = {
      id: seasonalPriceId,
      ...data,
    };
    setSeasonalPrices(prev => [...prev, created]);
    const roomTypeLabel =
      roomTypeName ?? roomTypes.find(rt => rt.id === created.roomTypeId)?.name;
    recordActivity({
      section: "seasonal_prices",
      entityType: "seasonal_price",
      entityId: created.id,
      entityLabel: created.name || `${roomTypeLabel ?? "Room"} seasonal price`,
      action: "seasonal_price_created",
      details: `Created seasonal price ${created.name || ""} for ${roomTypeLabel ?? "room"}`,
    });
    return created;
  };

  const updateSeasonalPrice = async (
    id: string,
    updatedData: Partial<Omit<SeasonalPrice, "id">>,
    existingSeasonalPrice?: SeasonalPrice
  ) => {
    const previousSeasonalPrice =
      existingSeasonalPrice ?? seasonalPrices.find(sp => sp.id === id);
    if (previousSeasonalPrice) {
      const updated: SeasonalPrice = { ...previousSeasonalPrice, ...updatedData };
      const { error } = await api.updateSeasonalPriceWithoutReturning(id, updatedData);
      if (error) throw error;
      setSeasonalPrices(prev => prev.map(sp => sp.id === id ? updated : sp));
      recordActivity({
        section: "seasonal_prices",
        entityType: "seasonal_price",
        entityId: id,
        entityLabel: updated.name || id,
        action: "seasonal_price_updated",
        details: `Updated seasonal price ${updated.name || ""}`,
      });
      return;
    }

    const { error } = await api.updateSeasonalPriceWithoutReturning(id, updatedData);
    if (error) throw error;
    const label = updatedData.name || id;
    recordActivity({
      section: "seasonal_prices",
      entityType: "seasonal_price",
      entityId: id,
      entityLabel: label,
      action: "seasonal_price_updated",
      details: `Updated seasonal price ${label === id ? "" : label}`,
    });
  };

  const deleteSeasonalPrice = async (
    id: string,
    existingSeasonalPrice?: SeasonalPrice
  ) => {
    const existing =
      existingSeasonalPrice ?? seasonalPrices.find(sp => sp.id === id);
    const { error } = await api.deleteSeasonalPrice(id);
    if (error) { console.error(error); return false; }
    setSeasonalPrices(prev => prev.filter(sp => sp.id !== id));
    if (existing) {
      recordActivity({
        section: "seasonal_prices",
        entityType: "seasonal_price",
        entityId: existing.id,
        entityLabel: existing.name || id,
        action: "seasonal_price_deleted",
        details: `Deleted seasonal price ${existing.name || ""}`,
      });
    }
    return true;
  };

  const addPropertyClosure = async (data: Omit<PropertyClosure, "id">) => {
    const { data: closureId, error } = await api.addPropertyClosureIdOnly(data);
    if (error || !closureId) {
      throw error ?? new Error("Failed to create property closure");
    }
    const created: PropertyClosure = {
      id: closureId,
      ...data,
    };
    setPropertyClosures(prev => [...prev, created]);
    recordActivity({
      section: "settings",
      entityType: "property",
      entityId: created.id,
      entityLabel: created.reason || `Closure ${created.startDate} – ${created.endDate}`,
      action: "property_closure_created",
      details: `Blocked dates ${created.startDate} to ${created.endDate}`,
    });
    return created;
  };

  const updatePropertyClosure = async (
    id: string,
    updatedData: Partial<Omit<PropertyClosure, "id">>,
    existingClosure?: PropertyClosure
  ) => {
    const previousClosure =
      existingClosure ?? propertyClosures.find(c => c.id === id);
    if (previousClosure) {
      const updatedClosure: PropertyClosure = { ...previousClosure, ...updatedData };
      const { error } = await api.updatePropertyClosureWithoutReturning(
        id,
        updatedData,
      );
      if (error) throw error;
      setPropertyClosures(prev => prev.map(c => c.id === id ? updatedClosure : c));
      recordActivity({
        section: "settings",
        entityType: "property",
        entityId: id,
        entityLabel: updatedClosure.reason || `Closure ${updatedClosure.startDate} – ${updatedClosure.endDate}`,
        action: "property_closure_updated",
        details: `Updated blocked dates ${updatedClosure.startDate} to ${updatedClosure.endDate}`,
      });
      return;
    }

    const { error } = await api.updatePropertyClosureWithoutReturning(
      id,
      updatedData,
    );
    if (error) throw error;
    const fallbackLabel =
      updatedData.reason ||
      (updatedData.startDate && updatedData.endDate
        ? `Closure ${updatedData.startDate} – ${updatedData.endDate}`
        : id);
    const fallbackDetails =
      updatedData.startDate && updatedData.endDate
        ? `Updated blocked dates ${updatedData.startDate} to ${updatedData.endDate}`
        : `Updated blocked dates ${id}`;
    recordActivity({
      section: "settings",
      entityType: "property",
      entityId: id,
      entityLabel: fallbackLabel,
      action: "property_closure_updated",
      details: fallbackDetails,
    });
  };

  const deletePropertyClosure = async (
    id: string,
    existingClosure?: PropertyClosure
  ) => {
    const existing = existingClosure ?? propertyClosures.find(c => c.id === id);
    const { error } = await api.deletePropertyClosure(id);
    if (error) { console.error(error); return false; }
    setPropertyClosures(prev => prev.filter(c => c.id !== id));
    if (existing) {
      recordActivity({
        section: "settings",
        entityType: "property",
        entityId: existing.id,
        entityLabel: existing.reason || `Closure ${existing.startDate} – ${existing.endDate}`,
        action: "property_closure_deleted",
        details: `Deleted blocked dates ${existing.startDate} to ${existing.endDate}`,
      });
    }
    return true;
  };

  const addRole = async (roleData: Omit<Role, "id">) => {
    const { data: roleId, error } = await api.addRoleIdOnly(roleData);
    if (error || !roleId) {
      throw error ?? new Error("Failed to create role");
    }
    const createdRole: Role = {
      id: roleId,
      ...roleData,
    };
    setRoles(prev => [...prev, createdRole]);
    recordActivity({
      section: "roles",
      entityType: "role",
      entityId: createdRole.id,
      entityLabel: createdRole.name,
      action: "role_created",
      details: `Created role ${createdRole.name}`,
      metadata: { permissions: createdRole.permissions, hierarchyLevel: createdRole.hierarchyLevel },
    });
  };

  const updateRole = async (
    roleId: string,
    updatedData: Partial<Omit<Role, "id">>,
    existingRole?: Role
  ) => {
    const previousRole = existingRole ?? roles.find((role) => role.id === roleId);
    if (previousRole) {
      const updatedRole: Role = { ...previousRole, ...updatedData };
      const { error } = await api.updateRoleWithoutReturning(roleId, updatedData);
      if (error) throw error;
      setRoles(prev => prev.map(r => r.id === roleId ? updatedRole : r));
      const changedFields = extractChangedFields(previousRole, updatedData);
      recordActivity({
        section: "roles",
        entityType: "role",
        entityId: roleId,
        entityLabel: updatedRole.name,
        action: "role_updated",
        details: `Updated role ${updatedRole.name}`,
        metadata: changedFields.length ? { changedFields } : undefined,
      });
      return;
    }

    const { error } = await api.updateRoleWithoutReturning(roleId, updatedData);
    if (error) throw error;
    const roleLabel = updatedData.name || roleId;
    const changedFields = extractChangedFields(undefined, updatedData);
    recordActivity({
      section: "roles",
      entityType: "role",
      entityId: roleId,
      entityLabel: roleLabel,
      action: "role_updated",
      details: `Updated role ${roleLabel}`,
      metadata: changedFields.length ? { changedFields } : undefined,
    });
  };

  const deleteRole = async (roleId: string) => {
    const role = roles.find((r) => r.id === roleId);
    const { error } = await api.deleteRole(roleId);
    if (error) { console.error(error); return false; }
    setRoles(prev => prev.filter(r => r.id !== roleId));
    if (role) {
      recordActivity({
        section: "roles",
        entityType: "role",
        entityId: role.id,
        entityLabel: role.name,
        action: "role_deleted",
        details: `Deleted role ${role.name}`,
      });
    }
    return true;
  };

  const updateUser = async (
    userId: string,
    updatedData: Partial<Omit<User, "id">>,
    existingUser?: User
  ) => {
    const targetUser = existingUser ?? users.find((user) => user.id === userId);
    const payload: UserProfileUpdate = {};
    if (typeof updatedData.name !== "undefined") {
      payload.name = updatedData.name;
    }
    if (typeof updatedData.roleId !== "undefined") {
      payload.roleId = updatedData.roleId;
    }

    if (Object.keys(payload).length === 0) {
      return;
    }

    if (targetUser) {
      const updatedUser: User = { ...targetUser, ...payload };
      const { error } = await api.updateUserProfileWithoutReturning(
        userId,
        payload,
      );
      if (error) throw error;
      setUsers(prev => prev.map(u => u.id === userId ? updatedUser : u));
      const changedFields = extractChangedFields(targetUser, payload);
      recordActivity({
        section: "users",
        entityType: "user",
        entityId: userId,
        entityLabel: updatedUser.name ?? userId,
        action: "user_updated",
        details: `Updated user ${updatedUser.name ?? userId}`,
        metadata: changedFields.length ? { changedFields } : undefined,
      });
      return;
    }

    const { error } = await api.updateUserProfileWithoutReturning(
      userId,
      payload,
    );
    if (error) throw error;
    const userLabel = payload.name ?? userId;
    const changedFields = extractChangedFields(undefined, payload);
    recordActivity({
      section: "users",
      entityType: "user",
      entityId: userId,
      entityLabel: userLabel,
      action: "user_updated",
      details: `Updated user ${userLabel}`,
      metadata: changedFields.length ? { changedFields } : undefined,
    });
  };

  const deleteUser = async (userIdToDelete: string) => {
    if (userId === userIdToDelete) return false;
    const user = users.find((u) => u.id === userIdToDelete);
    const { error } = await api.deleteAuthUser(userIdToDelete);
    if (error) { console.error(error); return false; }
    setUsers(prev => prev.filter(u => u.id !== userIdToDelete));
    if (user) {
      recordActivity({
        section: "users",
        entityType: "user",
        entityId: user.id,
        entityLabel: user.name ?? user.email ?? user.id,
        action: "user_deleted",
        details: `Deleted user ${user.name ?? user.email ?? user.id}`,
      });
    }
    return true;
  };

  const refetchUsers = React.useCallback(async () => {
    const { data, error } = await api.getUsers();
    if (error) console.error("Error refetching users:", error);
    else setUsers(data || []);
  }, []);

  const refetchRoles = React.useCallback(async () => {
    const { data, error } = await api.getRoles();
    if (error) console.error("Error refetching roles:", error);
    else setRoles((data || []).map(mapDbRole));
  }, []);

  const refetchAmenities = React.useCallback(async () => {
    const { data, error } = await api.getAmenities();
    if (error) console.error("Error refetching amenities:", error);
    else setAmenities(data || []);
  }, []);

  const refetchStickyNotes = React.useCallback(async () => {
    if (!userId) {
      setStickyNotes([]);
      return;
    }

    const { data, error } = await api.getStickyNotes(userId);
    if (error) console.error("Error refetching sticky notes:", error);
    else setStickyNotes(data || []);
  }, [userId]);

  const addAmenity = async (amenityData: Omit<Amenity, "id">) => {
    const { data: amenityId, error } = await api.addAmenityIdOnly(amenityData);
    if (error || !amenityId) {
      throw error ?? new Error("Failed to create amenity");
    }
    const createdAmenity: Amenity = {
      id: amenityId,
      ...amenityData,
    };
    setAmenities(prev => [...prev, createdAmenity]);
    recordActivity({
      section: "amenities",
      entityType: "amenity",
      entityId: createdAmenity.id,
      entityLabel: createdAmenity.name,
      action: "amenity_created",
      details: `Created amenity ${createdAmenity.name}`,
    });
  };

  const updateAmenity = async (
    amenityId: string,
    updatedData: Partial<Omit<Amenity, "id">>,
    existingAmenity?: Amenity
  ) => {
    const previousAmenity =
      existingAmenity ?? amenities.find((amenity) => amenity.id === amenityId);
    if (previousAmenity) {
      const updatedAmenity: Amenity = { ...previousAmenity, ...updatedData };
      const { error } = await api.updateAmenityWithoutReturning(
        amenityId,
        updatedData,
      );
      if (error) throw error;
      setAmenities(prev => prev.map(a => a.id === amenityId ? updatedAmenity : a));
      const changedFields = extractChangedFields(previousAmenity, updatedData);
      recordActivity({
        section: "amenities",
        entityType: "amenity",
        entityId: amenityId,
        entityLabel: updatedAmenity.name,
        action: "amenity_updated",
        details: `Updated amenity ${updatedAmenity.name}`,
        metadata: changedFields.length ? { changedFields } : undefined,
      });
      return;
    }

    const { error } = await api.updateAmenityWithoutReturning(
      amenityId,
      updatedData,
    );
    if (error) throw error;
    const amenityLabel = updatedData.name || amenityId;
    const changedFields = extractChangedFields(undefined, updatedData);
    recordActivity({
      section: "amenities",
      entityType: "amenity",
      entityId: amenityId,
      entityLabel: amenityLabel,
      action: "amenity_updated",
      details: `Updated amenity ${amenityLabel}`,
      metadata: changedFields.length ? { changedFields } : undefined,
    });
  };

  const deleteAmenity = async (amenityId: string) => {
    const amenity = amenities.find((a) => a.id === amenityId);
    const { error } = await api.deleteAmenity(amenityId);
    if (error) { console.error(error); return false; }
    setAmenities(prev => prev.filter(a => a.id !== amenityId));
    if (amenity) {
      recordActivity({
        section: "amenities",
        entityType: "amenity",
        entityId: amenity.id,
        entityLabel: amenity.name,
        action: "amenity_deleted",
        details: `Deleted amenity ${amenity.name}`,
      });
    }
    return true;
  };

  const addStickyNote = async (noteData: Omit<StickyNote, "id" | "createdAt">) => {
    if (!userId) throw new Error("User must be authenticated to add sticky notes");
    const { data: noteId, error } = await api.addStickyNoteIdOnly({ ...noteData, user_id: userId });
    if (error || !noteId) {
      throw error ?? new Error("Failed to create sticky note");
    }
    const createdNote: StickyNote = {
      id: noteId,
      ...noteData,
      createdAt: new Date().toISOString(),
    };
    setStickyNotes(prev => [...prev, createdNote]);
    recordActivity({
      section: "sticky_notes",
      entityType: "sticky_note",
      entityId: createdNote.id,
      entityLabel: createdNote.title,
      action: "sticky_note_created",
      details: `Created note ${createdNote.title}`,
    });
  };

  const updateStickyNote = async (
    noteId: string,
    updatedData: Partial<Omit<StickyNote, "id" | "createdAt">>,
    existingNote?: StickyNote
  ) => {
    const previousNote =
      existingNote ?? stickyNotes.find((note) => note.id === noteId);
    if (previousNote) {
      const updatedNote: StickyNote = { ...previousNote, ...updatedData };
      const { error } = await api.updateStickyNoteWithoutReturning(
        noteId,
        updatedData,
      );
      if (error) throw error;
      setStickyNotes(prev => prev.map(n => n.id === noteId ? updatedNote : n));
      const changedFields = extractChangedFields(previousNote, updatedData);
      recordActivity({
        section: "sticky_notes",
        entityType: "sticky_note",
        entityId: noteId,
        entityLabel: updatedNote.title,
        action: "sticky_note_updated",
        details: `Updated note ${updatedNote.title}`,
        metadata: changedFields.length ? { changedFields } : undefined,
      });
      return;
    }

    const { error } = await api.updateStickyNoteWithoutReturning(
      noteId,
      updatedData,
    );
    if (error) throw error;
    const noteLabel = updatedData.title || noteId;
    const changedFields = extractChangedFields(undefined, updatedData);
    recordActivity({
      section: "sticky_notes",
      entityType: "sticky_note",
      entityId: noteId,
      entityLabel: noteLabel,
      action: "sticky_note_updated",
      details: `Updated note ${noteLabel}`,
      metadata: changedFields.length ? { changedFields } : undefined,
    });
  };

  const deleteStickyNote = async (noteId: string) => {
    const note = stickyNotes.find((n) => n.id === noteId);
    const { error } = await api.deleteStickyNote(noteId);
    if (error) throw error;
    setStickyNotes(prev => prev.filter(n => n.id !== noteId));
    if (note) {
      recordActivity({
        section: "sticky_notes",
        entityType: "sticky_note",
        entityId: note.id,
        entityLabel: note.title,
        action: "sticky_note_deleted",
        details: `Deleted note ${note.title}`,
      });
    }
  };

  const assignHousekeeper = async (assignment: { roomId: string; userId: string; }) => {
    // This would involve an upsert operation in a real scenario
    console.log("Assigning housekeeper:", assignment);
    recordActivity({
      section: "housekeeping",
      entityType: "housekeeping_assignment",
      entityId: assignment.roomId,
      entityLabel: assignment.roomId,
      action: "housekeeping_assigned",
      details: `Assigned housekeeper ${assignment.userId} to room ${assignment.roomId}`,
      metadata: assignment,
    });
  };

  const updateAssignmentStatus = async (roomId: string, status: "Pending" | "Completed") => {
    console.log("Updating assignment status:", roomId, status);
    recordActivity({
      section: "housekeeping",
      entityType: "housekeeping_assignment",
      entityId: roomId,
      entityLabel: roomId,
      action: "housekeeping_status_updated",
      details: `Marked room ${roomId} as ${status}`,
      metadata: { status },
    });
  };

  const updateDashboardLayoutState = (layout: DashboardComponentId[]) => {
    setDashboardLayout(layout);
    recordActivity({
      section: "dashboard",
      entityType: "dashboard_layout",
      entityId: property.id,
      entityLabel: property.name,
      action: "dashboard_layout_updated",
      details: "Updated dashboard layout",
      metadata: { layout },
    });
  };

  const validateBookingRequest = React.useCallback(
    (
      checkIn: string,
      checkOut: string,
      roomId: string,
      adults: number,
      children: number = 0,
      bookingId?: string
    ) => api.validateBookingRequest(checkIn, checkOut, roomId, adults, children, bookingId),
    []
  );

  return {
    isLoading,
    isRefreshing,
    isReservationsInitialLoading,
    isBookingLookupLoading,
    isSessionLoading,
    lookupStatus,
    activeBookingReservations,
    activeBookingRooms,
    activeBookingRoomTypes,
    activeBookingRatePlans,
    reservationsTotalCount,
    property,
    bookings,
    reservations,
    todayReservations,
    guests,
    rooms,
    roomTypes,
    roomCategories,
    ratePlans,
    seasonalPrices,
    propertyClosures,
    users,
    roles,
    amenities,
    stickyNotes,
    dashboardLayout,
    housekeepingAssignments,
    updateProperty,
    addGuest,
    deleteGuest,
    addReservation,
    addRoomsToBooking,
    refetchUsers,
    refetchRoles,
    refetchAmenities,
    refetchStickyNotes,
    updateGuest,
    updateReservation,
    updateReservationStatus,
    updateBookingReservationStatus,
    addFolioItem,
    assignHousekeeper,
    updateAssignmentStatus,
    addRoom,
    updateRoom,
    deleteRoom,
    addRoomType,
    updateRoomType,
    deleteRoomType,
    addRoomCategory,
    updateRoomCategory,
    deleteRoomCategory,
    addRatePlan,
    updateRatePlan,
    deleteRatePlan,
    addSeasonalPrice,
    updateSeasonalPrice,
    deleteSeasonalPrice,
    addPropertyClosure,
    updatePropertyClosure,
    deletePropertyClosure,
    addRole,
    updateRole,
    deleteRole,
    updateUser,
    deleteUser,
    addAmenity,
    updateAmenity,
    deleteAmenity,
    addStickyNote,
    updateStickyNote,
    deleteStickyNote,
    updateDashboardLayout: updateDashboardLayoutState,
    validateBookingRequest,
    refreshReservations,
    loadReservationsPage,
    loadBookingDetails,
    logActivity: recordActivity,
  };
}

"use client";

import * as React from "react";
import { useSessionContext } from "@/context/session-context";
import { useActivityLogger } from "@/hooks/use-activity-logger";
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

const mapDbRole = (role: Role & { hierarchy_level?: number }): Role => ({
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

      const { data, error } = await api.updateReservation(reservation.id, {
        adultCount: adults,
        childCount: children,
        numberOfGuests: guests,
      });

      if (error || !data) {
        return reservation;
      }

      return {
        ...data,
        folio: reservation.folio,
      };
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

export function useAppData() {
  const { session, isLoading: isSessionLoading } = useSessionContext();
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
  const [isLoading, setIsLoading] = React.useState(true);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const hasHydratedRef = React.useRef(false);

  const [isReservationsInitialLoading, setIsReservationsInitialLoading] = React.useState(true);
  const [isBookingLookupLoading, setIsBookingLookupLoading] = React.useState(false);
  const [lookupStatus, setLookupStatus] = React.useState<Record<string, 'pending' | 'success' | 'error'>>({});
  const [activeBookingReservations, setActiveBookingReservations] = React.useState<Reservation[]>([]);
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
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
        let targetBookingId = "";

        if (isUUID) {
          console.log(`[Lookup] Fetching by UUID: ${id}`);
          const { data: res } = await api.getReservationById(id);
          if (res) {
            targetBookingId = res.bookingId;
            console.log(`[Lookup] Found bookingId: ${targetBookingId} for UUID: ${id}`);
            // Fetch guest if not in current state
            if (res.guestId) {
              const { data: guestData } = await api.getGuestById(res.guestId);
              if (guestData) {
                setGuests(prev => {
                  if (prev.some(g => g.id === guestData.id)) return prev;
                  return [...prev, guestData];
                });
              }
            }
          } else {
            console.warn(`[Lookup] No reservation found for UUID: ${id}`);
          }
        } else {
          console.log(`[Lookup] Assuming ID is booking code: ${id}`);
          targetBookingId = id;
        }

        if (targetBookingId) {
          console.log(`[Lookup] Fetching siblings for bookingId: ${targetBookingId}`);
          const { data: siblings } = await api.getReservationsByBookingId(targetBookingId);
          if (siblings && siblings.length > 0) {
            console.log(`[Lookup] Successfully found ${siblings.length} records for ${targetBookingId}`);
            setActiveBookingReservations(siblings);
            setLookupStatus(prev => ({ ...prev, [id]: 'success' }));
          } else {
            console.warn(`[Lookup] No records found for bookingId: ${targetBookingId}`);
            setLookupStatus(prev => ({ ...prev, [id]: 'error' }));
          }
        } else {
          console.warn(`[Lookup] Could not resolve targetBookingId for ${id}`);
          setLookupStatus(prev => ({ ...prev, [id]: 'error' }));
        }
      } catch (error) {
        console.error(`[Lookup] Error during lookup for ${id}:`, error);
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

    if (shouldUseLoadingState) {
      setIsLoading(true);
      setIsReservationsInitialLoading(true);
    } else {
      setIsRefreshing(true);
    }

    try {
      console.log(`[AppData] Fetching global data (userId: ${userId})`);
      const [
        propertyRes, guestsRes, roomsRes, roomTypesRes, roomCategoriesRes, ratePlansRes,
        seasonalPricesRes, propertyClosuresRes,
        rolesRes, amenitiesRes, stickyNotesRes, usersFuncRes, housekeepingAssignmentsRes,
        roomTypeAmenitiesRes,
        dashboardReservationsRes
      ] = await Promise.all([
        api.getProperty(),
        userId ? api.getGuests() : Promise.resolve({ data: [] }),
        api.getRooms(),
        api.getRoomTypes(),
        api.getRoomCategories(),
        api.getRatePlans(),
        api.getSeasonalPrices(),
        api.getPropertyClosures().then(data => ({ data })).catch(() => ({ data: [] as PropertyClosure[] })),
        userId ? api.getRoles() : Promise.resolve({ data: [] }),
        api.getAmenities(),
        userId ? api.getStickyNotes(userId) : Promise.resolve({ data: [] }),
        userId ? api.getUsers() : Promise.resolve({ data: [] }),
        userId ? api.getHousekeepingAssignments() : Promise.resolve({ data: [] }),
        api.getRoomTypeAmenities(),
        userId
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

      if (!userId) {
        console.log("[AppData] No user session found, clearing state");
        if (propertyRes.data) setProperty({ ...defaultProperty, ...propertyRes.data });
        setGuests([]);
        setRooms(roomsRes.data || []);
        setRatePlans(ratePlansRes.data || []);
        setSeasonalPrices(seasonalPricesRes.data || []);
        setPropertyClosures(propertyClosuresRes.data || []);
        setRoles([]);
        setAmenities(amenitiesRes.data || []);
        setStickyNotes([]);
        setUsers([]);
        setHousekeepingAssignments([]);
        setBookings([]);
        setReservations([]);
        setTodayReservations([]);
        setReservationsTotalCount(0);
        setIsReservationsInitialLoading(false);
        setRoomTypes(roomTypesData);
        setRoomCategories(roomCategoriesRes.data || []);
        if (!alreadyHydrated) {
          hasHydratedRef.current = true;
        }
        if (shouldUseLoadingState) {
          setIsLoading(false);
        } else {
          setIsRefreshing(false);
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
      setStickyNotes(stickyNotesRes.data || []);
      setUsers(usersFuncRes.data || []);
      setHousekeepingAssignments(housekeepingAssignmentsRes.data || []);

      const bookingsData = dashboardReservationsRes.data ?? [];
      const flatReservations = bookingsData.flatMap(b => b.subRows || []);

      setTodayReservations(sortReservationsByBookingDate(flatReservations));
      setReservations(sortReservationsByBookingDate(flatReservations));
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
  }, [userId, isSessionLoading]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Lazy-load full reservations in the background after initial render
  React.useEffect(() => {
    if (isLoading || isSessionLoading || !userId) return;

    let cancelled = false;
    api.getReservations().then((res) => {
      if (cancelled) return;
      if (Array.isArray(res.data)) {
        setReservations(sortReservationsByBookingDate(res.data));
      }
    }).catch((err) => {
      console.error("[AppData] Failed to lazy-load reservations:", err);
    });

    return () => { cancelled = true; };
  }, [isLoading, isSessionLoading, userId]);

  const refreshReservations = React.useCallback(() => fetchData({ keepExisting: true }), [fetchData]);

  const triggerReservationsCacheRevalidation = React.useCallback(() => {
    void revalidateReservationsCache();
  }, []);

  const updateProperty = async (updatedData: Partial<Omit<Property, "id">>) => {
    const changedFields = extractChangedFields(property, updatedData);
    const { data, error } = property.id === "default-property-id"
      ? await api.createProperty(updatedData)
      : await api.updateProperty(property.id, updatedData);
    if (error) throw error;
    setProperty({ ...defaultProperty, ...data });
    recordActivity({
      section: "property",
      entityType: "property",
      entityId: data.id,
      entityLabel: data.name,
      action: property.id === "default-property-id" ? "property_created" : "property_updated",
      details: property.id === "default-property-id"
        ? "Created property configuration"
        : "Updated property settings",
      metadata: changedFields.length ? { changedFields } : undefined,
    });
  };

  const addGuest = async (guestData: Omit<Guest, "id">) => {
    const { data, error } = await api.addGuest(guestData);
    if (error) throw error;
    setGuests(prev => [...prev, data]);
    const label = formatName(data.firstName, data.lastName) || data.email;
    recordActivity({
      section: "guests",
      entityType: "guest",
      entityId: data.id,
      entityLabel: label,
      action: "guest_created",
      details: `Added guest ${label}`,
      metadata: { email: data.email, phone: data.phone },
    });
    return data;
  };

  const updateGuest = async (guestId: string, updatedData: Partial<Omit<Guest, "id">>) => {
    const previousGuest = guests.find((g) => g.id === guestId);
    const { data, error } = await api.updateGuest(guestId, updatedData);
    if (error) throw error;
    setGuests(prev => prev.map(g => g.id === guestId ? data : g));
    const label = formatName(data.firstName, data.lastName) || data.email;
    const changedFields = extractChangedFields(previousGuest, updatedData);
    recordActivity({
      section: "guests",
      entityType: "guest",
      entityId: data.id,
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

    const { data, error } = await api.createReservationsWithTotal({
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

    const normalizedOccupancies = normalizeRoomOccupancies(
      roomIds,
      reservationDetails.adultCount,
      reservationDetails.childCount,
      roomOccupancies
    );

    let reservationsWithEmptyFolio: Reservation[] = data.map((r) => ({
      ...r,
      folio: [],
    }));
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

    const { data, error } = await api.createReservationsWithTotal({
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

    const normalizedOccupancies = normalizeRoomOccupancies(
      payload.roomIds,
      payload.adultCount,
      payload.childCount,
      roomOccupancies
    );

    let createdReservations: Reservation[] = data.map((reservation) => ({
      ...reservation,
      folio: reservation.folio ?? [],
    }));

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
    const previousReservation = reservations.find((reservation) => reservation.id === reservationId);
    const { data, error } = await api.updateReservation(reservationId, updatedData);
    if (error) throw error;
    setReservations(prev => prev.map(r => r.id === reservationId ? { ...r, ...data } : r));
    triggerReservationsCacheRevalidation();
    const changedFields = extractChangedFields(previousReservation, updatedData);
    recordActivity({
      section: "reservations",
      entityType: "reservation",
      entityId: reservationId,
      entityLabel: data.bookingId,
      action: "reservation_updated",
      details: `Updated reservation ${data.bookingId}`,
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
    const { data, error } = await api.updateBookingReservationsStatus(
      bookingId,
      status
    );
    if (error) throw error;
    if (!data?.length) {
      return;
    }

    const updatesById = new Map(data.map((entry) => [entry.id, entry]));
    setReservations((prev) =>
      prev.map((reservation) => {
        const updated = updatesById.get(reservation.id);
        if (!updated) {
          return reservation;
        }
        return {
          ...reservation,
          ...updated,
          folio: reservation.folio,
        };
      })
    );
    triggerReservationsCacheRevalidation();

    data.forEach((updatedReservation) => {
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
      details: `Changed booking ${bookingId} status to ${status} for ${data.length} rooms`,
      metadata: { status, bookingId, affectedReservations: data.length },
    });
  };

  const addFolioItem = async (
    reservationId: string,
    item: Omit<FolioItem, "id" | "timestamp">
  ) => {
    const { data, error } = await api.addFolioItem({
      reservation_id: reservationId,
      description: item.description,
      amount: item.amount,
      payment_method: item.paymentMethod ?? null,
      transaction_id: item.transactionId ?? null,
      external_source: item.externalSource ?? undefined,
      external_reference: item.externalReference ?? null,
      external_metadata: item.externalMetadata ?? undefined,
    });
    if (error || !data) {
      if (error && typeof error === "object" && "message" in error) {
        throw new Error(String((error as { message?: string }).message || "Failed to add folio item"));
      }
      throw new Error("Failed to add folio item");
    }
    const inserted = data as {
      id: string;
      description: string;
      amount: number;
      timestamp: string | null;
      payment_method: string | null;
      transaction_id: string | null;
      external_source: string | null;
      external_reference: string | null;
      external_metadata: Record<string, unknown> | null;
    };
    const folioItem: FolioItem = {
      id: inserted.id,
      description: inserted.description,
      amount: inserted.amount,
      timestamp: inserted.timestamp ?? new Date().toISOString(),
      paymentMethod: inserted.payment_method ?? undefined,
      transactionId: inserted.transaction_id ?? undefined,
      externalSource: inserted.external_source ?? undefined,
      externalReference: inserted.external_reference ?? undefined,
      externalMetadata: inserted.external_metadata ?? undefined,
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
    const { data, error } = await api.upsertRoomType({
      ...roomTypeData,
      isVisible: roomTypeData.isVisible ?? true,
    });
    if (error || !data) throw error ?? new Error("Failed to create room type.");
    const newRoomType = api.fromDbRoomType(
      data as Parameters<typeof api.fromDbRoomType>[0]
    );
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

  const updateRoomType = async (roomTypeId: string, updatedData: Partial<Omit<RoomType, "id">>) => {
    const existingRoomType = roomTypes.find((roomType) => roomType.id === roomTypeId);
    if (!existingRoomType) {
      throw new Error("Room type not found.");
    }

    const payload = {
      id: roomTypeId,
      name: updatedData.name ?? existingRoomType.name,
      description: updatedData.description ?? existingRoomType.description,
      maxOccupancy: updatedData.maxOccupancy ?? existingRoomType.maxOccupancy,
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

    const { data, error } = await api.upsertRoomType(payload);
    if (error || !data) throw error ?? new Error("Failed to update room type.");
    const updatedRoomType = api.fromDbRoomType(
      data as Parameters<typeof api.fromDbRoomType>[0]
    );
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
    const { data: newRoom, error } = await api.addRoom(roomData);
    if (error) throw error;
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

  const updateRoom = async (roomId: string, updatedData: Partial<Omit<Room, "id">>) => {
    const previousRoom = rooms.find((room) => room.id === roomId);
    const { data: updatedRoom, error } = await api.updateRoom(roomId, updatedData);
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
  };

  const deleteRoom = async (roomId: string) => {
    const room = rooms.find((r) => r.id === roomId);
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

  const deleteRoomType = async (roomTypeId: string) => {
    const roomType = roomTypes.find((rt) => rt.id === roomTypeId);
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
    const { data, error } = await api.addRoomCategory(roomCategoryData);
    if (error) throw error;
    setRoomCategories(prev => [...prev, data]);
    recordActivity({
      section: "room_categories",
      entityType: "room_category",
      entityId: data.id,
      entityLabel: data.name,
      action: "room_category_created",
      details: `Created room category ${data.name}`,
    });
  };

  const updateRoomCategory = async (roomCategoryId: string, updatedData: Partial<Omit<RoomCategory, "id">>): Promise<void> => {
    const previousRoomCategory = roomCategories.find((rc) => rc.id === roomCategoryId);
    const { data, error } = await api.updateRoomCategory(roomCategoryId, updatedData);
    if (error) throw error;
    setRoomCategories(prev => prev.map(rc => rc.id === roomCategoryId ? data : rc));
    const changedFields = extractChangedFields(previousRoomCategory, updatedData);
    recordActivity({
      section: "room_categories",
      entityType: "room_category",
      entityId: roomCategoryId,
      entityLabel: data.name,
      action: "room_category_updated",
      details: `Updated room category ${data.name}`,
      metadata: changedFields.length ? { changedFields } : undefined,
    });
  };

  const deleteRoomCategory = async (roomCategoryId: string): Promise<boolean> => {
    const roomCategory = roomCategories.find((rc) => rc.id === roomCategoryId);
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
    const { data, error } = await api.addRatePlan(ratePlanData);
    if (error) throw error;
    setRatePlans(prev => [...prev, data]);
    recordActivity({
      section: "rate_plans",
      entityType: "rate_plan",
      entityId: data.id,
      entityLabel: data.name,
      action: "rate_plan_created",
      details: `Created rate plan ${data.name}`,
    });
  };

  const updateRatePlan = async (ratePlanId: string, updatedData: Partial<Omit<RatePlan, "id">>) => {
    const previousRatePlan = ratePlans.find((rp) => rp.id === ratePlanId);
    const { data, error } = await api.updateRatePlan(ratePlanId, updatedData);
    if (error) throw error;
    setRatePlans(prev => prev.map(rp => rp.id === ratePlanId ? data : rp));
    const changedFields = extractChangedFields(previousRatePlan, updatedData);
    recordActivity({
      section: "rate_plans",
      entityType: "rate_plan",
      entityId: ratePlanId,
      entityLabel: data.name,
      action: "rate_plan_updated",
      details: `Updated rate plan ${data.name}`,
      metadata: changedFields.length ? { changedFields } : undefined,
    });
  };

  const deleteRatePlan = async (ratePlanId: string) => {
    const ratePlan = ratePlans.find((rp) => rp.id === ratePlanId);
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

  const addSeasonalPrice = async (data: Omit<SeasonalPrice, "id">) => {
    const { data: created, error } = await api.addSeasonalPrice(data);
    if (error || !created) throw error ?? new Error("Failed to create seasonal price");
    setSeasonalPrices(prev => [...prev, created]);
    const roomType = roomTypes.find(rt => rt.id === created.roomTypeId);
    recordActivity({
      section: "seasonal_prices",
      entityType: "seasonal_price",
      entityId: created.id,
      entityLabel: created.name || `${roomType?.name ?? "Room"} seasonal price`,
      action: "seasonal_price_created",
      details: `Created seasonal price ${created.name || ""} for ${roomType?.name ?? "room"}`,
    });
    return created;
  };

  const updateSeasonalPrice = async (id: string, updatedData: Partial<Omit<SeasonalPrice, "id">>) => {
    const { data: updated, error } = await api.updateSeasonalPrice(id, updatedData);
    if (error || !updated) throw error ?? new Error("Failed to update seasonal price");
    setSeasonalPrices(prev => prev.map(sp => sp.id === id ? updated : sp));
    recordActivity({
      section: "seasonal_prices",
      entityType: "seasonal_price",
      entityId: id,
      entityLabel: updated.name || id,
      action: "seasonal_price_updated",
      details: `Updated seasonal price ${updated.name || ""}`,
    });
  };

  const deleteSeasonalPrice = async (id: string) => {
    const existing = seasonalPrices.find(sp => sp.id === id);
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
    const { data: created, error } = await api.addPropertyClosure(data);
    if (error || !created) throw error ?? new Error("Failed to create property closure");
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

  const updatePropertyClosure = async (id: string, updatedData: Partial<Omit<PropertyClosure, "id">>) => {
    const { data: updated, error } = await api.updatePropertyClosure(id, updatedData);
    if (error || !updated) throw error ?? new Error("Failed to update property closure");
    setPropertyClosures(prev => prev.map(c => c.id === id ? updated : c));
    recordActivity({
      section: "settings",
      entityType: "property",
      entityId: id,
      entityLabel: updated.reason || `Closure ${updated.startDate} – ${updated.endDate}`,
      action: "property_closure_updated",
      details: `Updated blocked dates ${updated.startDate} to ${updated.endDate}`,
    });
  };

  const deletePropertyClosure = async (id: string) => {
    const existing = propertyClosures.find(c => c.id === id);
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
    const { data, error } = await api.addRole(roleData);
    if (error) throw error;
    const mappedRole = mapDbRole(data as Role & { hierarchy_level?: number });
    setRoles(prev => [...prev, mappedRole]);
    recordActivity({
      section: "roles",
      entityType: "role",
      entityId: mappedRole.id,
      entityLabel: mappedRole.name,
      action: "role_created",
      details: `Created role ${mappedRole.name}`,
      metadata: { permissions: mappedRole.permissions, hierarchyLevel: mappedRole.hierarchyLevel },
    });
  };

  const updateRole = async (roleId: string, updatedData: Partial<Omit<Role, "id">>) => {
    const previousRole = roles.find((role) => role.id === roleId);
    const { data, error } = await api.updateRole(roleId, updatedData);
    if (error) throw error;
    const mappedRole = mapDbRole(data as Role & { hierarchy_level?: number });
    setRoles(prev => prev.map(r => r.id === roleId ? mappedRole : r));
    const changedFields = extractChangedFields(previousRole, updatedData);
    recordActivity({
      section: "roles",
      entityType: "role",
      entityId: roleId,
      entityLabel: mappedRole.name,
      action: "role_updated",
      details: `Updated role ${mappedRole.name}`,
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

  const updateUser = async (userId: string, updatedData: Partial<Omit<User, "id">>) => {
    const targetUser = users.find((user) => user.id === userId);
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

    const { data, error } = await api.updateUserProfile(userId, payload);
    if (error || !data) throw error ?? new Error("Failed to update user profile");
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, name: data.name, roleId: data.role_id } : u));
    const changedFields = extractChangedFields(targetUser, payload);
    recordActivity({
      section: "users",
      entityType: "user",
      entityId: userId,
      entityLabel: data.name ?? userId,
      action: "user_updated",
      details: `Updated user ${data.name ?? userId}`,
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

  const addAmenity = async (amenityData: Omit<Amenity, "id">) => {
    const { data, error } = await api.addAmenity(amenityData);
    if (error) throw error;
    setAmenities(prev => [...prev, data]);
    recordActivity({
      section: "amenities",
      entityType: "amenity",
      entityId: data.id,
      entityLabel: data.name,
      action: "amenity_created",
      details: `Created amenity ${data.name}`,
    });
  };

  const updateAmenity = async (amenityId: string, updatedData: Partial<Omit<Amenity, "id">>) => {
    const previousAmenity = amenities.find((amenity) => amenity.id === amenityId);
    const { data, error } = await api.updateAmenity(amenityId, updatedData);
    if (error) throw error;
    setAmenities(prev => prev.map(a => a.id === amenityId ? data : a));
    const changedFields = extractChangedFields(previousAmenity, updatedData);
    recordActivity({
      section: "amenities",
      entityType: "amenity",
      entityId: amenityId,
      entityLabel: data.name,
      action: "amenity_updated",
      details: `Updated amenity ${data.name}`,
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
    const { data, error } = await api.addStickyNote({ ...noteData, user_id: userId });
    if (error) throw error;
    setStickyNotes(prev => [...prev, data]);
    recordActivity({
      section: "sticky_notes",
      entityType: "sticky_note",
      entityId: data.id,
      entityLabel: data.title,
      action: "sticky_note_created",
      details: `Created note ${data.title}`,
    });
  };

  const updateStickyNote = async (noteId: string, updatedData: Partial<Omit<StickyNote, "id" | "createdAt">>) => {
    const previousNote = stickyNotes.find((note) => note.id === noteId);
    const { data, error } = await api.updateStickyNote(noteId, updatedData);
    if (error) throw error;
    setStickyNotes(prev => prev.map(n => n.id === noteId ? data : n));
    const changedFields = extractChangedFields(previousNote, updatedData);
    recordActivity({
      section: "sticky_notes",
      entityType: "sticky_note",
      entityId: noteId,
      entityLabel: data.title,
      action: "sticky_note_updated",
      details: `Updated note ${data.title}`,
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

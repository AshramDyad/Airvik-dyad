import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Amenity, FolioItem, Guest, Property, PropertyClosure, RatePlan, Reservation, Role, Room, RoomCategory, RoomType, SeasonalPrice, StickyNote, User } from "@/data/types";

const sessionState = vi.hoisted(() => ({
  value: {
    session: { user: { id: "user-1" } },
    isLoading: false,
    roleName: null,
  },
}));

const pathnameState = vi.hoisted(() => ({
  value: "/about-us",
}));

const authorizedFetchMock = vi.hoisted(() =>
  vi.fn(async () =>
    new Response(JSON.stringify({ data: [], nextOffset: null, count: 0 }), {
      status: 200,
    })
  )
);

const logActivityMock = vi.hoisted(() => vi.fn());

const apiMock = vi.hoisted(() => ({
  getProperty: vi.fn(async () => ({
    data: {
      id: "property-1",
      name: "Airvik",
      currency: "INR",
    } as Property | null,
    error: null,
  })),
  getGuests: vi.fn(async () => ({ data: [], error: null })),
  getRooms: vi.fn(async () => ({ data: [], error: null })),
  getRoomTypes: vi.fn(() => ({ data: [], error: null })),
  getRoomCategories: vi.fn(() => ({ data: [], error: null })),
  getRatePlans: vi.fn(() => ({ data: [], error: null })),
  getSeasonalPrices: vi.fn(async () => ({ data: [], error: null })),
  getPropertyClosures: vi.fn(async () => []),
  getRoles: vi.fn(() => ({
    data: [] as Array<{
      id: string;
      name: string;
      permissions: string[];
      hierarchy_level: number;
    }>,
    error: null,
  })),
  getAmenities: vi.fn(() => ({
    data: [] as Array<{ id: string; name: string; icon: string }>,
    error: null,
  })),
  getStickyNotes: vi.fn(() => ({ data: [] as StickyNote[], error: null })),
  getUsers: vi.fn(async () => ({
    data: [] as Array<{
      id: string;
      name: string;
      email: string;
      roleId: string;
    }>,
    error: null,
  })),
  getHousekeepingAssignments: vi.fn(() => ({ data: [], error: null })),
  getRoomTypeAmenities: vi.fn(() => ({ data: [], error: null })),
  getReservations: vi.fn(async () => ({ data: [], error: null })),
  getReservationById: vi.fn(async () => ({ data: null, error: null })),
  getGuestById: vi.fn(async () => ({ data: null, error: null })),
  getReservationsByBookingId: vi.fn(async () => ({ data: [], error: null })),
  createReservationsWithTotal: vi.fn(async () => ({ data: [] as Reservation[], error: null })),
  createReservationsWithTotalMinimal: vi.fn(async () => ({
    data: [] as Array<{
      id: string;
      bookingId: string;
      roomId: string;
      totalAmount: number;
      bookingDate: string;
    }>,
    error: null,
  })),
  createProperty: vi.fn(async () => ({
    data: {
      id: "property-1",
      name: "Created Property",
      currency: "INR",
    },
    error: null,
  })),
  createPropertyIdAndDefaults: vi.fn(async () => ({
    data: {
      id: "property-2",
      allowSameDayTurnover: false,
      showPartialDays: false,
      defaultUnitsView: "booked",
    },
    error: null,
  })),
  updateProperty: vi.fn(async () => ({
    data: {
      id: "property-1",
      name: "Legacy Returned Property",
      currency: "INR",
    },
    error: null,
  })),
  updatePropertyWithoutReturning: vi.fn(async () => ({
    data: null,
    error: null,
  })),
  addGuest: vi.fn(async () => ({
    data: {
      id: "legacy-guest-1",
      firstName: "Legacy",
      lastName: "Guest",
      email: "legacy@example.com",
      phone: "111",
    },
    error: null,
  })),
  addGuestIdOnly: vi.fn(async () => ({
    data: "guest-2",
    error: null,
  })),
  updateGuest: vi.fn(async () => ({
    data: {
      id: "guest-1",
      firstName: "Legacy",
      lastName: "Guest",
      email: "legacy@example.com",
      phone: "111",
    },
    error: null,
  })),
  updateGuestWithoutReturning: vi.fn(async () => ({
    data: null,
    error: null,
  })),
  updateReservation: vi.fn(async () => ({
    data: {
      id: "reservation-1",
      bookingId: "Legacy Returned Booking",
      guestId: "guest-1",
      roomId: "room-1",
      ratePlanId: "rate-plan-1",
      checkInDate: "2026-06-10",
      checkOutDate: "2026-06-12",
      numberOfGuests: 2,
      status: "Confirmed",
      notes: "Legacy returned note",
      folio: [],
      totalAmount: 2000,
      bookingDate: "2026-05-13T00:00:00.000Z",
      source: "reception",
      paymentMethod: "UPI",
      adultCount: 2,
      childCount: 0,
      taxEnabledSnapshot: true,
      taxRateSnapshot: 0.12,
    },
    error: null,
  })),
  updateReservationWithoutReturning: vi.fn(async () => ({
    data: null,
    error: null,
  })),
  updateReservationStatus: vi.fn(async () => ({
    data: null,
    error: null,
  })),
  updateBookingReservationsStatus: vi.fn(async () => ({
    data: [],
    error: null,
  })),
  updateBookingReservationsStatusWithoutReturning: vi.fn(async () => ({
    data: null,
    error: null,
    count: null as number | null,
  })),
  upsertRoomType: vi.fn(async () => ({
    data: {
      id: "legacy-room-type-1",
      name: "Legacy Returned Room Type",
      description: "Legacy",
      max_occupancy: 9,
      min_occupancy: 1,
      max_children: 0,
      category_id: null,
      bed_types: ["Legacy"],
      price: 999,
      amenities: [],
      photos: [],
      main_photo_url: null,
      is_visible: true,
    },
    error: null,
  })),
  upsertRoomTypeMinimal: vi.fn(async () => ({
    data: {
      id: "room-type-2",
      minOccupancy: 1,
      maxChildren: 0,
      categoryId: null,
    } as {
      id: string;
      minOccupancy: number | null;
      maxChildren: number | null;
      categoryId: string | null;
    } | null,
    error: null,
  })),
  addFolioItem: vi.fn(async () => ({
    data: {
      id: "legacy-folio-1",
      description: "Legacy charge",
      amount: 999,
      timestamp: "2026-05-14T15:00:00.000Z",
      payment_method: null,
      transaction_id: null,
      external_source: "internal",
      external_reference: null,
      external_metadata: {},
    },
    error: null,
  })),
  addFolioItemIdAndTimestamp: vi.fn(async () => ({
    data: { id: "folio-2", timestamp: "2026-05-14T16:30:00.000Z" },
    error: null,
  })),
  addRoom: vi.fn(async () => ({
    data: {
      id: "legacy-room-1",
      roomNumber: "999",
      roomTypeId: "type-1",
      status: "Dirty",
    },
    error: null,
  })),
  addRoomIdOnly: vi.fn(async () => ({
    data: "room-2",
    error: null,
  })),
  updateRoom: vi.fn(async () => ({
    data: {
      id: "room-1",
      roomNumber: "999",
      roomTypeId: "type-1",
      status: "Dirty",
    },
    error: null,
  })),
  updateRoomWithoutReturning: vi.fn(async () => ({ data: null, error: null })),
  addRoomCategory: vi.fn(async () => ({
    data: {
      id: "legacy-category-1",
      name: "Legacy Returned Category",
      description: "Legacy",
    },
    error: null,
  })),
  addRoomCategoryIdOnly: vi.fn(async () => ({
    data: "category-2",
    error: null,
  })),
  updateRoomCategory: vi.fn(async () => ({
    data: {
      id: "category-1",
      name: "Legacy Returned Category",
      description: "Legacy",
    },
    error: null,
  })),
  updateRoomCategoryWithoutReturning: vi.fn(async () => ({
    data: null,
    error: null,
  })),
  addRatePlan: vi.fn(async () => ({
    data: {
      id: "legacy-rate-1",
      name: "Legacy Returned Rate",
      price: 999,
      rules: {
        minStay: 1,
        cancellationPolicy: "Legacy",
      },
    },
    error: null,
  })),
  addRatePlanIdOnly: vi.fn(async () => ({
    data: "rate-2",
    error: null,
  })),
  updateRatePlan: vi.fn(async () => ({
    data: {
      id: "rate-1",
      name: "Legacy Returned Rate",
      price: 999,
      rules: {
        minStay: 1,
        cancellationPolicy: "Legacy",
      },
    },
    error: null,
  })),
  updateRatePlanWithoutReturning: vi.fn(async () => ({ data: null, error: null })),
  addSeasonalPrice: vi.fn(async () => ({
    data: {
      id: "legacy-seasonal-1",
      roomTypeId: "room-type-1",
      name: "Legacy Returned Season",
      price: 999,
      startDate: "2026-06-01",
      endDate: "2026-06-30",
    },
    error: null,
  })),
  addSeasonalPriceIdOnly: vi.fn(async () => ({
    data: "seasonal-2",
    error: null,
  })),
  updateSeasonalPrice: vi.fn(async () => ({
    data: {
      id: "seasonal-1",
      roomTypeId: "room-type-1",
      name: "Legacy Returned Season",
      price: 999,
      startDate: "2026-06-01",
      endDate: "2026-06-30",
    },
    error: null,
  })),
  updateSeasonalPriceWithoutReturning: vi.fn(async () => ({
    data: null,
    error: null,
  })),
  addPropertyClosure: vi.fn(async () => ({
    data: {
      id: "legacy-closure-1",
      propertyId: "property-1",
      startDate: "2026-06-01",
      endDate: "2026-06-03",
      reason: "Legacy Returned Closure",
    },
    error: null,
  })),
  addPropertyClosureIdOnly: vi.fn(async () => ({
    data: "closure-2",
    error: null,
  })),
  updatePropertyClosure: vi.fn(async () => ({
    data: {
      id: "closure-1",
      propertyId: "property-1",
      startDate: "2026-06-01",
      endDate: "2026-06-03",
      reason: "Legacy Returned Closure",
    },
    error: null,
  })),
  updatePropertyClosureWithoutReturning: vi.fn(async () => ({
    data: null,
    error: null,
  })),
  addRole: vi.fn(async () => ({
    data: {
      id: "legacy-role-1",
      name: "Legacy Returned Role",
      permissions: ["read:room"],
      hierarchy_level: 1,
    },
    error: null,
  })),
  addRoleIdOnly: vi.fn(async () => ({
    data: "role-2",
    error: null,
  })),
  updateRole: vi.fn(async () => ({
    data: {
      id: "role-1",
      name: "Legacy Returned Role",
      permissions: ["read:room"],
      hierarchy_level: 1,
    },
    error: null,
  })),
  updateRoleWithoutReturning: vi.fn(async () => ({
    data: null,
    error: null,
  })),
  updateUserProfile: vi.fn(async () => ({
    data: {
      id: "user-2",
      name: "Legacy Returned User",
      role_id: "role-1",
    },
    error: null,
  })),
  updateUserProfileWithoutReturning: vi.fn(async () => ({
    data: null,
    error: null,
  })),
  addAmenity: vi.fn(async () => ({
    data: {
      id: "legacy-amenity-1",
      name: "Legacy Returned Amenity",
      icon: "Circle",
    },
    error: null,
  })),
  addAmenityIdOnly: vi.fn(async () => ({
    data: "amenity-2",
    error: null,
  })),
  updateAmenity: vi.fn(async () => ({
    data: {
      id: "amenity-1",
      name: "Legacy Returned Amenity",
      icon: "Circle",
    },
    error: null,
  })),
  updateAmenityWithoutReturning: vi.fn(async () => ({
    data: null,
    error: null,
  })),
  addStickyNote: vi.fn(async () => ({
    data: {
      id: "legacy-note-1",
      title: "Legacy Returned Note",
      description: "Legacy",
      color: "yellow",
      createdAt: "2026-05-13T00:00:00.000Z",
    },
    error: null,
  })),
  addStickyNoteIdOnly: vi.fn(async () => ({
    data: "note-2",
    error: null,
  })),
  updateStickyNote: vi.fn(async () => ({
    data: {
      id: "note-1",
      title: "Legacy Returned Note",
      description: "Legacy",
      color: "yellow",
      createdAt: "2026-05-13T00:00:00.000Z",
    },
    error: null,
  })),
  updateStickyNoteWithoutReturning: vi.fn(async () => ({
    data: null,
    error: null,
  })),
  fromDbRoomType: vi.fn((roomType) => roomType),
  validateBookingRequest: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => pathnameState.value,
}));

vi.mock("@/context/session-context", () => ({
  useSessionContext: () => sessionState.value,
}));

vi.mock("@/hooks/use-activity-logger", () => ({
  useActivityLogger: () => ({ logActivity: logActivityMock }),
}));

vi.mock("@/lib/auth/client-session", () => ({
  authorizedFetch: authorizedFetchMock,
}));

vi.mock("@/lib/reservations/cache-client", () => ({
  revalidateReservationsCache: vi.fn(),
}));

vi.mock("@/lib/api", () => apiMock);

import { useAppData } from "./use-app-data";

const getLocalDateKey = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;

const expectPublicPropertyFetch = () => {
  expect(apiMock.getProperty).not.toHaveBeenCalled();
  expect(authorizedFetchMock).toHaveBeenCalledWith("/api/public/property", {
    cache: "force-cache",
  });
};

const makeReservation = (overrides: Partial<Reservation> = {}): Reservation => ({
  id: "reservation-1",
  bookingId: "A1001",
  guestId: "guest-1",
  roomId: "room-1",
  ratePlanId: "rate-plan-1",
  checkInDate: "2026-06-10",
  checkOutDate: "2026-06-12",
  numberOfGuests: 2,
  status: "Confirmed",
  notes: "Keep pillow",
  folio: [],
  totalAmount: 2000,
  bookingDate: "2026-05-13T00:00:00.000Z",
  source: "reception",
  paymentMethod: "UPI",
  adultCount: 2,
  childCount: 0,
  taxEnabledSnapshot: true,
  taxRateSnapshot: 0.12,
  ...overrides,
});

describe("useAppData route-aware loading", () => {
  beforeEach(() => {
    pathnameState.value = "/about-us";
    sessionState.value = {
      session: { user: { id: "user-1" } },
      isLoading: false,
      roleName: null,
    };
    vi.clearAllMocks();
  });

  it("does not load admin or booking datasets on logged-in public static pages", async () => {
    const { result } = renderHook(() => useAppData());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(apiMock.getProperty).not.toHaveBeenCalled();
    expect(apiMock.getGuests).not.toHaveBeenCalled();
    expect(apiMock.getRooms).not.toHaveBeenCalled();
    expect(apiMock.getRoomTypes).not.toHaveBeenCalled();
    expect(apiMock.getRatePlans).not.toHaveBeenCalled();
    expect(apiMock.getSeasonalPrices).not.toHaveBeenCalled();
    expect(apiMock.getPropertyClosures).not.toHaveBeenCalled();
    expect(apiMock.getRoles).not.toHaveBeenCalled();
    expect(apiMock.getUsers).not.toHaveBeenCalled();
    expect(apiMock.getHousekeepingAssignments).not.toHaveBeenCalled();
    expect(authorizedFetchMock).not.toHaveBeenCalled();
  });

  it("uses the narrower settings dataset on admin settings routes", async () => {
    pathnameState.value = "/admin/settings";

    const { result } = renderHook(() => useAppData());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(apiMock.getProperty).toHaveBeenCalledTimes(1);
    expect(apiMock.getRoles).not.toHaveBeenCalled();
    expect(apiMock.getUsers).not.toHaveBeenCalled();
    expect(apiMock.getAmenities).not.toHaveBeenCalled();
    expect(apiMock.getRooms).not.toHaveBeenCalled();
    expect(apiMock.getRoomTypes).not.toHaveBeenCalled();
    expect(apiMock.getPropertyClosures).not.toHaveBeenCalled();

    expect(apiMock.getGuests).not.toHaveBeenCalled();
    expect(apiMock.getStickyNotes).not.toHaveBeenCalled();
    expect(apiMock.getHousekeepingAssignments).not.toHaveBeenCalled();
    expect(authorizedFetchMock).not.toHaveBeenCalled();
    expect(apiMock.getReservations).not.toHaveBeenCalled();
  });

  it("lazy-loads settings amenities on demand", async () => {
    pathnameState.value = "/admin/settings";
    const amenities = [{ id: "amenity-1", name: "Wifi", icon: "Wifi" }];
    apiMock.getAmenities.mockReturnValueOnce({ data: amenities, error: null });

    const { result } = renderHook(() => useAppData());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(apiMock.getAmenities).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.refetchAmenities();
    });

    expect(apiMock.getAmenities).toHaveBeenCalledTimes(1);
    expect(result.current.amenities).toEqual(amenities);
  });

  it("lazy-loads settings roles and users on demand", async () => {
    pathnameState.value = "/admin/settings";
    const roles = [
      {
        id: "role-1",
        name: "Manager",
        permissions: ["read:user"],
        hierarchy_level: 2,
      },
    ];
    const users = [
      {
        id: "user-2",
        name: "Nira",
        email: "nira@example.com",
        roleId: "role-1",
      },
    ];
    apiMock.getRoles.mockReturnValueOnce({ data: roles, error: null });
    apiMock.getUsers.mockResolvedValueOnce({ data: users, error: null });

    const { result } = renderHook(() => useAppData());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(apiMock.getRoles).not.toHaveBeenCalled();
    expect(apiMock.getUsers).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.refetchRoles();
      await result.current.refetchUsers();
    });

    expect(apiMock.getRoles).toHaveBeenCalledTimes(1);
    expect(apiMock.getUsers).toHaveBeenCalledTimes(1);
    expect(result.current.roles).toEqual([
      {
        id: "role-1",
        name: "Manager",
        permissions: ["read:user"],
        hierarchyLevel: 2,
      },
    ]);
    expect(result.current.users).toEqual(users);
  });

  it("uses only chrome data on self-fetching admin content routes", async () => {
    pathnameState.value = "/admin/posts";

    const { result } = renderHook(() => useAppData());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(apiMock.getProperty).toHaveBeenCalledTimes(1);
    expect(apiMock.getGuests).not.toHaveBeenCalled();
    expect(apiMock.getRooms).not.toHaveBeenCalled();
    expect(apiMock.getRoomTypes).not.toHaveBeenCalled();
    expect(apiMock.getRatePlans).not.toHaveBeenCalled();
    expect(apiMock.getSeasonalPrices).not.toHaveBeenCalled();
    expect(apiMock.getPropertyClosures).not.toHaveBeenCalled();
    expect(apiMock.getRoles).not.toHaveBeenCalled();
    expect(apiMock.getUsers).not.toHaveBeenCalled();
    expect(apiMock.getHousekeepingAssignments).not.toHaveBeenCalled();
    expect(authorizedFetchMock).not.toHaveBeenCalled();
    expect(apiMock.getReservations).not.toHaveBeenCalled();
  });

  it("lazy-loads dashboard sticky notes on demand", async () => {
    pathnameState.value = "/admin/dashboard";
    const notes: StickyNote[] = [
      {
        id: "note-1",
        title: "Follow up",
        description: "Call the guest",
        color: "yellow",
        createdAt: "2026-05-16T00:00:00.000Z",
      },
    ];
    apiMock.getStickyNotes.mockReturnValueOnce({ data: notes, error: null });

    const { result } = renderHook(() => useAppData());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(apiMock.getStickyNotes).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.refetchStickyNotes();
    });

    expect(apiMock.getStickyNotes).toHaveBeenCalledTimes(1);
    expect(apiMock.getStickyNotes).toHaveBeenCalledWith("user-1");
    expect(result.current.stickyNotes).toEqual(notes);
  });

  it("lets the admin rooms page use its route-backed room API", async () => {
    pathnameState.value = "/admin/rooms";

    const { result } = renderHook(() => useAppData());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(apiMock.getProperty).toHaveBeenCalledTimes(1);
    expect(apiMock.getRooms).not.toHaveBeenCalled();
    expect(apiMock.getRoomTypes).not.toHaveBeenCalled();
    expect(apiMock.getGuests).not.toHaveBeenCalled();
    expect(apiMock.getRatePlans).not.toHaveBeenCalled();
    expect(apiMock.getSeasonalPrices).not.toHaveBeenCalled();
    expect(apiMock.getRoles).not.toHaveBeenCalled();
    expect(apiMock.getUsers).not.toHaveBeenCalled();
    expect(apiMock.getHousekeepingAssignments).not.toHaveBeenCalled();
    expect(authorizedFetchMock).not.toHaveBeenCalled();
    expect(apiMock.getReservations).not.toHaveBeenCalled();
  });

  it("lets the admin rates page use its route-backed rates API", async () => {
    pathnameState.value = "/admin/rates";

    const { result } = renderHook(() => useAppData());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(apiMock.getProperty).toHaveBeenCalledTimes(1);
    expect(apiMock.getRatePlans).not.toHaveBeenCalled();
    expect(apiMock.getSeasonalPrices).not.toHaveBeenCalled();
    expect(apiMock.getRoomTypes).not.toHaveBeenCalled();
    expect(apiMock.getRooms).not.toHaveBeenCalled();
    expect(apiMock.getGuests).not.toHaveBeenCalled();
    expect(apiMock.getRoles).not.toHaveBeenCalled();
    expect(apiMock.getUsers).not.toHaveBeenCalled();
    expect(apiMock.getHousekeepingAssignments).not.toHaveBeenCalled();
    expect(authorizedFetchMock).not.toHaveBeenCalled();
    expect(apiMock.getReservations).not.toHaveBeenCalled();
  });

  it("lets the admin room types page use its route-backed room type API", async () => {
    pathnameState.value = "/admin/room-types";

    const { result } = renderHook(() => useAppData());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(apiMock.getProperty).toHaveBeenCalledTimes(1);
    expect(apiMock.getRoomTypes).not.toHaveBeenCalled();
    expect(apiMock.getRoomTypeAmenities).not.toHaveBeenCalled();
    expect(apiMock.getAmenities).not.toHaveBeenCalled();
    expect(apiMock.getRooms).not.toHaveBeenCalled();
    expect(apiMock.getGuests).not.toHaveBeenCalled();
    expect(apiMock.getRatePlans).not.toHaveBeenCalled();
    expect(apiMock.getSeasonalPrices).not.toHaveBeenCalled();
    expect(apiMock.getRoles).not.toHaveBeenCalled();
    expect(apiMock.getUsers).not.toHaveBeenCalled();
    expect(apiMock.getHousekeepingAssignments).not.toHaveBeenCalled();
    expect(authorizedFetchMock).not.toHaveBeenCalled();
    expect(apiMock.getReservations).not.toHaveBeenCalled();
  });

  it("loads dashboard data without unrelated configuration datasets", async () => {
    pathnameState.value = "/admin/dashboard";

    const { result } = renderHook(() => useAppData());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(apiMock.getProperty).toHaveBeenCalledTimes(1);
    expect(apiMock.getGuests).not.toHaveBeenCalled();
    expect(apiMock.getRooms).not.toHaveBeenCalled();
    expect(apiMock.getRoomTypes).not.toHaveBeenCalled();
    expect(apiMock.getStickyNotes).not.toHaveBeenCalled();
    expect(authorizedFetchMock).not.toHaveBeenCalled();

    expect(apiMock.getRoomCategories).not.toHaveBeenCalled();
    expect(apiMock.getRatePlans).not.toHaveBeenCalled();
    expect(apiMock.getSeasonalPrices).not.toHaveBeenCalled();
    expect(apiMock.getPropertyClosures).not.toHaveBeenCalled();
    expect(apiMock.getRoles).not.toHaveBeenCalled();
    expect(apiMock.getUsers).not.toHaveBeenCalled();
    expect(apiMock.getHousekeepingAssignments).not.toHaveBeenCalled();
  });

  it("lets the room categories page use its route-backed category API", async () => {
    pathnameState.value = "/admin/room-categories";

    const { result } = renderHook(() => useAppData());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(apiMock.getProperty).toHaveBeenCalledTimes(1);
    expect(apiMock.getRoomCategories).not.toHaveBeenCalled();
    expect(apiMock.getRooms).not.toHaveBeenCalled();
    expect(apiMock.getRoomTypes).not.toHaveBeenCalled();
    expect(apiMock.getGuests).not.toHaveBeenCalled();
    expect(apiMock.getRatePlans).not.toHaveBeenCalled();
    expect(apiMock.getSeasonalPrices).not.toHaveBeenCalled();
    expect(apiMock.getRoles).not.toHaveBeenCalled();
    expect(apiMock.getUsers).not.toHaveBeenCalled();
    expect(apiMock.getHousekeepingAssignments).not.toHaveBeenCalled();
    expect(authorizedFetchMock).not.toHaveBeenCalled();
  });

  it("does not lazy-load every reservation after dashboard startup", async () => {
    pathnameState.value = "/admin/dashboard";

    const { result } = renderHook(() => useAppData());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(authorizedFetchMock).not.toHaveBeenCalled();
    expect(apiMock.getReservations).not.toHaveBeenCalled();
  });

  it("lets the calendar use route-backed monthly and hover data", async () => {
    pathnameState.value = "/admin/calendar";

    const { result } = renderHook(() => useAppData());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(apiMock.getProperty).toHaveBeenCalledTimes(1);
    expect(apiMock.getGuests).not.toHaveBeenCalled();
    expect(apiMock.getRooms).not.toHaveBeenCalled();
    expect(apiMock.getRoomTypes).not.toHaveBeenCalled();

    expect(apiMock.getStickyNotes).not.toHaveBeenCalled();
    expect(apiMock.getRatePlans).not.toHaveBeenCalled();
    expect(apiMock.getSeasonalPrices).not.toHaveBeenCalled();
    expect(apiMock.getRoles).not.toHaveBeenCalled();
    expect(apiMock.getUsers).not.toHaveBeenCalled();
    expect(apiMock.getHousekeepingAssignments).not.toHaveBeenCalled();
    expect(authorizedFetchMock).not.toHaveBeenCalled();
    expect(apiMock.getReservations).not.toHaveBeenCalled();
  });

  it("loads reports shell data without reservation startup requests", async () => {
    pathnameState.value = "/admin/reports";

    const { result } = renderHook(() => useAppData());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(apiMock.getProperty).toHaveBeenCalledTimes(1);
    expect(apiMock.getRooms).not.toHaveBeenCalled();

    expect(apiMock.getGuests).not.toHaveBeenCalled();
    expect(apiMock.getRoomTypes).not.toHaveBeenCalled();
    expect(apiMock.getRatePlans).not.toHaveBeenCalled();
    expect(apiMock.getSeasonalPrices).not.toHaveBeenCalled();
    expect(apiMock.getStickyNotes).not.toHaveBeenCalled();
    expect(authorizedFetchMock).not.toHaveBeenCalled();
    expect(apiMock.getReservations).not.toHaveBeenCalled();
  });

  it("loads guest detail shell data without global reservation startup requests", async () => {
    pathnameState.value = "/admin/guests/guest-1";

    const { result } = renderHook(() => useAppData());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(apiMock.getProperty).toHaveBeenCalledTimes(1);
    expect(apiMock.getGuests).not.toHaveBeenCalled();
    expect(apiMock.getRooms).not.toHaveBeenCalled();

    expect(apiMock.getRoomTypes).not.toHaveBeenCalled();
    expect(apiMock.getRatePlans).not.toHaveBeenCalled();
    expect(apiMock.getSeasonalPrices).not.toHaveBeenCalled();
    expect(apiMock.getStickyNotes).not.toHaveBeenCalled();
    expect(authorizedFetchMock).not.toHaveBeenCalled();
    expect(apiMock.getReservations).not.toHaveBeenCalled();
  });

  it("does not hydrate all guests on the paginated guests index", async () => {
    pathnameState.value = "/admin/guests";

    const { result } = renderHook(() => useAppData());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(apiMock.getProperty).toHaveBeenCalledTimes(1);
    expect(apiMock.getGuests).not.toHaveBeenCalled();
    expect(apiMock.getRooms).not.toHaveBeenCalled();
    expect(apiMock.getRoomTypes).not.toHaveBeenCalled();
    expect(authorizedFetchMock).not.toHaveBeenCalled();
    expect(apiMock.getReservations).not.toHaveBeenCalled();
  });

  it("lets the admin housekeeping page use its route-backed housekeeping API", async () => {
    pathnameState.value = "/admin/housekeeping";

    const { result } = renderHook(() => useAppData());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(apiMock.getProperty).toHaveBeenCalledTimes(1);
    expect(apiMock.getRooms).not.toHaveBeenCalled();
    expect(apiMock.getRoomTypes).not.toHaveBeenCalled();
    expect(apiMock.getRoles).not.toHaveBeenCalled();
    expect(apiMock.getUsers).not.toHaveBeenCalled();
    expect(authorizedFetchMock).not.toHaveBeenCalled();
    expect(apiMock.getHousekeepingAssignments).not.toHaveBeenCalled();

    expect(apiMock.getGuests).not.toHaveBeenCalled();
    expect(apiMock.getStickyNotes).not.toHaveBeenCalled();
    expect(apiMock.getReservations).not.toHaveBeenCalled();
  });

  it("updates existing property settings without returning rows", async () => {
    pathnameState.value = "/admin/settings";
    const updatedProperty = {
      name: "Airvik Retreat",
      phone: "555-999-0000",
      tax_enabled: true,
      tax_percentage: 0.12,
    };

    const { result } = renderHook(() => useAppData());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.updateProperty(updatedProperty);
    });

    expect(apiMock.updatePropertyWithoutReturning).toHaveBeenCalledWith(
      "property-1",
      updatedProperty,
    );
    expect(apiMock.updateProperty).not.toHaveBeenCalled();
    expect(apiMock.createProperty).not.toHaveBeenCalled();
    expect(logActivityMock).toHaveBeenCalledWith(
      expect.objectContaining({
        section: "property",
        entityType: "property",
        entityId: "property-1",
        entityLabel: "Airvik Retreat",
        action: "property_updated",
        details: "Updated property settings",
        metadata: {
          changedFields: ["name", "phone", "tax_enabled", "tax_percentage"],
        },
      }),
    );
  });

  it("creates property settings by returning only the inserted id and database defaults", async () => {
    pathnameState.value = "/admin/settings";
    apiMock.getProperty.mockResolvedValueOnce({ data: null, error: null });
    const createdProperty = {
      name: "Airvik Retreat",
      address: "Rishikesh",
      phone: "555-999-0000",
      email: "hello@airvik.example",
      logo_url: "",
      photos: ["/property.jpg"],
      google_maps_url: undefined,
      currency: "INR",
      tax_enabled: true,
      tax_percentage: 0.12,
      trust_registration_no: undefined,
      trust_date: undefined,
      pan_no: undefined,
      certificate_no: undefined,
    } satisfies Partial<Omit<Property, "id">>;

    const { result } = renderHook(() => useAppData());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.updateProperty(createdProperty);
    });

    expect(apiMock.createPropertyIdAndDefaults).toHaveBeenCalledWith(createdProperty);
    expect(apiMock.createProperty).not.toHaveBeenCalled();
    expect(result.current.property).toMatchObject({
      id: "property-2",
      name: "Airvik Retreat",
      address: "Rishikesh",
      phone: "555-999-0000",
      email: "hello@airvik.example",
      photos: ["/property.jpg"],
      currency: "INR",
      tax_enabled: true,
      tax_percentage: 0.12,
      allowSameDayTurnover: false,
      showPartialDays: false,
      defaultUnitsView: "booked",
    });
    expect(logActivityMock).toHaveBeenCalledWith(
      expect.objectContaining({
        section: "property",
        entityType: "property",
        entityId: "property-2",
        entityLabel: "Airvik Retreat",
        action: "property_created",
        details: "Created property configuration",
        metadata: {
          changedFields: [
            "name",
            "address",
            "phone",
            "email",
            "logo_url",
            "photos",
            "google_maps_url",
            "tax_enabled",
            "tax_percentage",
          ],
        },
      }),
    );
  });

  it("updates guests without returning rows when an existing guest is available", async () => {
    pathnameState.value = "/admin/guests";
    const existingGuest: Guest = {
      id: "guest-1",
      firstName: "Ravi",
      lastName: "Singh",
      email: "ravi@example.com",
      phone: "111",
      city: "Dehradun",
      country: "IN",
    };
    const updatedGuest = {
      firstName: "Ravi Kumar",
      phone: "999",
      city: "Rishikesh",
    };

    const { result } = renderHook(() => useAppData());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.updateGuest("guest-1", updatedGuest, existingGuest);
    });

    expect(apiMock.updateGuestWithoutReturning).toHaveBeenCalledWith(
      "guest-1",
      updatedGuest,
    );
    expect(apiMock.updateGuest).not.toHaveBeenCalled();
    expect(logActivityMock).toHaveBeenCalledWith(
      expect.objectContaining({
        section: "guests",
        entityType: "guest",
        entityId: "guest-1",
        entityLabel: "Ravi Kumar Singh",
        action: "guest_updated",
        details: "Updated guest Ravi Kumar Singh",
        metadata: { changedFields: ["firstName", "phone", "city"] },
      }),
    );
  });

  it("updates guests without returning rows when no local guest is available", async () => {
    pathnameState.value = "/admin/guests";
    const updatedGuest = {
      firstName: "Ravi",
      phone: "999",
    };

    const { result } = renderHook(() => useAppData());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.updateGuest("guest-1", updatedGuest);
    });

    expect(apiMock.updateGuestWithoutReturning).toHaveBeenCalledWith(
      "guest-1",
      updatedGuest,
    );
    expect(apiMock.updateGuest).not.toHaveBeenCalled();
    expect(logActivityMock).toHaveBeenCalledWith(
      expect.objectContaining({
        section: "guests",
        entityType: "guest",
        entityId: "guest-1",
        entityLabel: "Ravi",
        action: "guest_updated",
        details: "Updated guest Ravi",
        metadata: { changedFields: ["firstName", "phone"] },
      }),
    );
  });

  it("adds guests by returning only the inserted id while preserving normalized local state", async () => {
    pathnameState.value = "/admin/guests";
    const newGuest = {
      firstName: " Ravi ",
      lastName: " Kumar ",
      email: "",
      phone: " 999 ",
      address: " ",
      pincode: "249201",
      city: " Rishikesh ",
      state: " Uttarakhand ",
      country: " India ",
    } satisfies Omit<Guest, "id">;

    const { result } = renderHook(() => useAppData());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let created: Guest | undefined;
    await act(async () => {
      created = await result.current.addGuest(newGuest);
    });

    expect(apiMock.addGuestIdOnly).toHaveBeenCalledWith(newGuest);
    expect(apiMock.addGuest).not.toHaveBeenCalled();
    expect(created).toEqual({
      id: "guest-2",
      firstName: "Ravi",
      lastName: "Kumar",
      email: "",
      phone: "999",
      address: "",
      pincode: "249201",
      city: "Rishikesh",
      state: "Uttarakhand",
      country: "India",
    });
    expect(logActivityMock).toHaveBeenCalledWith(
      expect.objectContaining({
        section: "guests",
        entityType: "guest",
        entityId: "guest-2",
        entityLabel: "Ravi Kumar",
        action: "guest_created",
        details: "Added guest Ravi Kumar",
        metadata: { email: "", phone: "999" },
      }),
    );
  });

  it("adds room types by returning only the id and defaulted local fields", async () => {
    pathnameState.value = "/admin/room-types";
    const newRoomType = {
      name: "Suite",
      description: "River view suite",
      maxOccupancy: 3,
      bedTypes: ["Queen"],
      price: 2500,
      amenities: ["amenity-1"],
      photos: ["/suite.jpg"],
      mainPhotoUrl: "/suite.jpg",
      isVisible: true,
    } satisfies Omit<RoomType, "id">;

    const { result } = renderHook(() => useAppData());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.addRoomType(newRoomType);
    });

    expect(apiMock.upsertRoomTypeMinimal).toHaveBeenCalledWith(newRoomType);
    expect(apiMock.upsertRoomType).not.toHaveBeenCalled();
    expect(result.current.roomTypes).toEqual([
      {
        id: "room-type-2",
        ...newRoomType,
        minOccupancy: 1,
        maxChildren: 0,
        categoryId: undefined,
      },
    ]);
    expect(logActivityMock).toHaveBeenCalledWith(
      expect.objectContaining({
        section: "room_types",
        entityType: "room_type",
        entityId: "room-type-2",
        entityLabel: "Suite",
        action: "room_type_created",
        details: "Created room type Suite",
      }),
    );
  });

  it("updates room types by returning only the id and preserving merged local state", async () => {
    pathnameState.value = "/admin/room-types";
    const existingRoomType: RoomType = {
      id: "room-type-1",
      name: "Suite",
      description: "River view suite",
      maxOccupancy: 3,
      minOccupancy: 2,
      maxChildren: 1,
      categoryId: "category-1",
      bedTypes: ["Queen"],
      price: 2500,
      amenities: ["amenity-1"],
      photos: ["/suite.jpg"],
      mainPhotoUrl: "/suite.jpg",
      isVisible: true,
    };
    apiMock.upsertRoomTypeMinimal.mockResolvedValueOnce({
      data: {
        id: "room-type-1",
        minOccupancy: 2,
        maxChildren: 1,
        categoryId: "category-1",
      },
      error: null,
    });

    const { result } = renderHook(() => useAppData());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.updateRoomType(
        "room-type-1",
        {
          name: "Deluxe Suite",
          price: 3000,
          amenities: ["amenity-2"],
        },
        existingRoomType,
      );
    });

    expect(apiMock.upsertRoomTypeMinimal).toHaveBeenCalledWith({
      id: "room-type-1",
      name: "Deluxe Suite",
      description: "River view suite",
      maxOccupancy: 3,
      minOccupancy: 2,
      maxChildren: 1,
      categoryId: "category-1",
      bedTypes: ["Queen"],
      price: 3000,
      photos: ["/suite.jpg"],
      mainPhotoUrl: "/suite.jpg",
      amenities: ["amenity-2"],
      isVisible: true,
    });
    expect(apiMock.upsertRoomType).not.toHaveBeenCalled();
    expect(logActivityMock).toHaveBeenCalledWith(
      expect.objectContaining({
        section: "room_types",
        entityType: "room_type",
        entityId: "room-type-1",
        entityLabel: "Deluxe Suite",
        action: "room_type_updated",
        details: "Updated room type Deluxe Suite",
        metadata: { changedFields: ["name", "price", "amenities"] },
      }),
    );
  });

  it("updates rooms without returning rows when an existing room is available", async () => {
    pathnameState.value = "/admin/housekeeping";
    const existingRoom = {
      id: "room-1",
      roomNumber: "101",
      roomTypeId: "type-1",
      status: "Clean" as const,
      photos: ["/room.jpg"],
    };

    const { result } = renderHook(() => useAppData());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.updateRoom(
        "room-1",
        { roomNumber: "102", status: "Dirty" },
        existingRoom,
      );
    });

    expect(apiMock.updateRoomWithoutReturning).toHaveBeenCalledWith("room-1", {
      roomNumber: "102",
      status: "Dirty",
    });
    expect(apiMock.updateRoom).not.toHaveBeenCalled();
    expect(logActivityMock).toHaveBeenCalledWith(
      expect.objectContaining({
        section: "rooms",
        entityType: "room",
        entityId: "room-1",
        entityLabel: "102",
        action: "room_updated",
        details: "Updated room 102",
        metadata: { changedFields: ["roomNumber", "status"] },
      }),
    );
  });

  it("updates rooms without returning rows when no local room is available", async () => {
    pathnameState.value = "/admin/rooms";
    const updatedRoom = {
      roomNumber: "102",
      status: "Dirty" as const,
    };

    const { result } = renderHook(() => useAppData());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.updateRoom("room-1", updatedRoom);
    });

    expect(apiMock.updateRoomWithoutReturning).toHaveBeenCalledWith(
      "room-1",
      updatedRoom,
    );
    expect(apiMock.updateRoom).not.toHaveBeenCalled();
    expect(logActivityMock).toHaveBeenCalledWith(
      expect.objectContaining({
        section: "rooms",
        entityType: "room",
        entityId: "room-1",
        entityLabel: "102",
        action: "room_updated",
        details: "Updated room 102",
        metadata: { changedFields: ["roomNumber", "status"] },
      }),
    );
  });

  it("adds rooms by returning only the inserted id", async () => {
    pathnameState.value = "/admin/rooms";
    const newRoom = {
      roomNumber: "102",
      roomTypeId: "type-1",
      status: "Clean",
      photos: ["/room.jpg"],
    } satisfies Omit<Room, "id">;

    const { result } = renderHook(() => useAppData());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.addRoom(newRoom);
    });

    expect(apiMock.addRoomIdOnly).toHaveBeenCalledWith(newRoom);
    expect(apiMock.addRoom).not.toHaveBeenCalled();
    expect(logActivityMock).toHaveBeenCalledWith(
      expect.objectContaining({
        section: "rooms",
        entityType: "room",
        entityId: "room-2",
        entityLabel: "102",
        action: "room_created",
        details: "Created room 102",
        metadata: { roomTypeId: "type-1" },
      }),
    );
  });

  it("updates room categories without returning rows when an existing category is available", async () => {
    pathnameState.value = "/admin/room-categories";
    const existingCategory = {
      id: "category-1",
      name: "Standard",
      description: "Standard rooms",
    };
    const updatedCategory = {
      name: "Suites",
      description: "Suite rooms",
    };

    const { result } = renderHook(() => useAppData());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.updateRoomCategory(
        "category-1",
        updatedCategory,
        existingCategory,
      );
    });

    expect(apiMock.updateRoomCategoryWithoutReturning).toHaveBeenCalledWith(
      "category-1",
      updatedCategory,
    );
    expect(apiMock.updateRoomCategory).not.toHaveBeenCalled();
    expect(logActivityMock).toHaveBeenCalledWith(
      expect.objectContaining({
        section: "room_categories",
        entityType: "room_category",
        entityId: "category-1",
        entityLabel: "Suites",
        action: "room_category_updated",
        details: "Updated room category Suites",
        metadata: { changedFields: ["name", "description"] },
      }),
    );
  });

  it("updates room categories without returning rows when no local category is available", async () => {
    pathnameState.value = "/admin/room-categories";
    const updatedCategory = {
      name: "Suites",
      description: "Suite rooms",
    };

    const { result } = renderHook(() => useAppData());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.updateRoomCategory("category-1", updatedCategory);
    });

    expect(apiMock.updateRoomCategoryWithoutReturning).toHaveBeenCalledWith(
      "category-1",
      updatedCategory,
    );
    expect(apiMock.updateRoomCategory).not.toHaveBeenCalled();
    expect(logActivityMock).toHaveBeenCalledWith(
      expect.objectContaining({
        section: "room_categories",
        entityType: "room_category",
        entityId: "category-1",
        entityLabel: "Suites",
        action: "room_category_updated",
        details: "Updated room category Suites",
        metadata: { changedFields: ["name", "description"] },
      }),
    );
  });

  it("adds room categories by returning only the inserted id", async () => {
    pathnameState.value = "/admin/room-categories";
    const newCategory = {
      name: "Suites",
      description: "Suite rooms",
    } satisfies Omit<RoomCategory, "id">;

    const { result } = renderHook(() => useAppData());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.addRoomCategory(newCategory);
    });

    expect(apiMock.addRoomCategoryIdOnly).toHaveBeenCalledWith(newCategory);
    expect(apiMock.addRoomCategory).not.toHaveBeenCalled();
    expect(logActivityMock).toHaveBeenCalledWith(
      expect.objectContaining({
        section: "room_categories",
        entityType: "room_category",
        entityId: "category-2",
        entityLabel: "Suites",
        action: "room_category_created",
        details: "Created room category Suites",
      }),
    );
  });

  it("updates rate plans without returning rows when an existing rate plan is available", async () => {
    pathnameState.value = "/admin/rates";
    const existingRatePlan = {
      id: "rate-1",
      name: "Standard",
      price: 1000,
      rules: {
        minStay: 1,
        cancellationPolicy: "Moderate",
      },
    };
    const updatedRatePlan = {
      name: "Flexible",
      price: 1200,
      rules: {
        minStay: 2,
        cancellationPolicy: "Flexible",
      },
    };

    const { result } = renderHook(() => useAppData());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.updateRatePlan("rate-1", updatedRatePlan, existingRatePlan);
    });

    expect(apiMock.updateRatePlanWithoutReturning).toHaveBeenCalledWith(
      "rate-1",
      updatedRatePlan,
    );
    expect(apiMock.updateRatePlan).not.toHaveBeenCalled();
    expect(logActivityMock).toHaveBeenCalledWith(
      expect.objectContaining({
        section: "rate_plans",
        entityType: "rate_plan",
        entityId: "rate-1",
        entityLabel: "Flexible",
        action: "rate_plan_updated",
        details: "Updated rate plan Flexible",
        metadata: { changedFields: ["name", "price", "rules"] },
      }),
    );
  });

  it("updates rate plans without returning rows when no local rate plan is available", async () => {
    pathnameState.value = "/admin/rates";
    const updatedRatePlan = {
      name: "Flexible",
      price: 1200,
    };

    const { result } = renderHook(() => useAppData());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.updateRatePlan("rate-1", updatedRatePlan);
    });

    expect(apiMock.updateRatePlanWithoutReturning).toHaveBeenCalledWith(
      "rate-1",
      updatedRatePlan,
    );
    expect(apiMock.updateRatePlan).not.toHaveBeenCalled();
    expect(logActivityMock).toHaveBeenCalledWith(
      expect.objectContaining({
        section: "rate_plans",
        entityType: "rate_plan",
        entityId: "rate-1",
        entityLabel: "Flexible",
        action: "rate_plan_updated",
        details: "Updated rate plan Flexible",
        metadata: { changedFields: ["name", "price"] },
      }),
    );
  });

  it("adds rate plans by returning only the inserted id", async () => {
    pathnameState.value = "/admin/rates";
    const newRatePlan = {
      name: "Flexible",
      price: 1200,
      rules: {
        minStay: 1,
        cancellationPolicy: "Free cancellation",
      },
    } satisfies Omit<RatePlan, "id">;

    const { result } = renderHook(() => useAppData());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.addRatePlan(newRatePlan);
    });

    expect(apiMock.addRatePlanIdOnly).toHaveBeenCalledWith(newRatePlan);
    expect(apiMock.addRatePlan).not.toHaveBeenCalled();
    expect(logActivityMock).toHaveBeenCalledWith(
      expect.objectContaining({
        section: "rate_plans",
        entityType: "rate_plan",
        entityId: "rate-2",
        entityLabel: "Flexible",
        action: "rate_plan_created",
        details: "Created rate plan Flexible",
      }),
    );
  });

  it("updates seasonal prices without returning rows when an existing seasonal price is available", async () => {
    pathnameState.value = "/admin/rates";
    const existingSeasonalPrice = {
      id: "seasonal-1",
      roomTypeId: "room-type-1",
      name: "Winter",
      price: 1000,
      startDate: "2026-06-01",
      endDate: "2026-06-30",
    };
    const updatedSeasonalPrice = {
      roomTypeId: "room-type-1",
      name: "Summer",
      price: 1500,
      startDate: "2026-06-01",
      endDate: "2026-06-30",
    };

    const { result } = renderHook(() => useAppData());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.updateSeasonalPrice(
        "seasonal-1",
        updatedSeasonalPrice,
        existingSeasonalPrice,
      );
    });

    expect(apiMock.updateSeasonalPriceWithoutReturning).toHaveBeenCalledWith(
      "seasonal-1",
      updatedSeasonalPrice,
    );
    expect(apiMock.updateSeasonalPrice).not.toHaveBeenCalled();
    expect(logActivityMock).toHaveBeenCalledWith(
      expect.objectContaining({
        section: "seasonal_prices",
        entityType: "seasonal_price",
        entityId: "seasonal-1",
        entityLabel: "Summer",
        action: "seasonal_price_updated",
        details: "Updated seasonal price Summer",
      }),
    );
  });

  it("updates seasonal prices without returning rows when no local seasonal price is available", async () => {
    pathnameState.value = "/admin/rates";
    const updatedSeasonalPrice = {
      roomTypeId: "room-type-1",
      name: "Summer",
      price: 1500,
      startDate: "2026-06-01",
      endDate: "2026-06-30",
    };

    const { result } = renderHook(() => useAppData());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.updateSeasonalPrice("seasonal-1", updatedSeasonalPrice);
    });

    expect(apiMock.updateSeasonalPriceWithoutReturning).toHaveBeenCalledWith(
      "seasonal-1",
      updatedSeasonalPrice,
    );
    expect(apiMock.updateSeasonalPrice).not.toHaveBeenCalled();
    expect(logActivityMock).toHaveBeenCalledWith(
      expect.objectContaining({
        section: "seasonal_prices",
        entityType: "seasonal_price",
        entityId: "seasonal-1",
        entityLabel: "Summer",
        action: "seasonal_price_updated",
        details: "Updated seasonal price Summer",
      }),
    );
  });

  it("adds seasonal prices by returning only the inserted id", async () => {
    pathnameState.value = "/admin/rates";
    const newSeasonalPrice = {
      roomTypeId: "room-type-1",
      name: "Summer",
      price: 1500,
      startDate: "2026-06-01",
      endDate: "2026-06-30",
    } satisfies Omit<SeasonalPrice, "id">;

    const { result } = renderHook(() => useAppData());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let created: SeasonalPrice | undefined;
    await act(async () => {
      created = await result.current.addSeasonalPrice(newSeasonalPrice, "Deluxe Room");
    });

    expect(apiMock.addSeasonalPriceIdOnly).toHaveBeenCalledWith(newSeasonalPrice);
    expect(apiMock.addSeasonalPrice).not.toHaveBeenCalled();
    expect(created).toEqual({ id: "seasonal-2", ...newSeasonalPrice });
    expect(logActivityMock).toHaveBeenCalledWith(
      expect.objectContaining({
        section: "seasonal_prices",
        entityType: "seasonal_price",
        entityId: "seasonal-2",
        entityLabel: "Summer",
        action: "seasonal_price_created",
        details: "Created seasonal price Summer for Deluxe Room",
      }),
    );
  });

  it("updates property closures without returning rows when an existing closure is available", async () => {
    pathnameState.value = "/admin/settings";
    const existingClosure: PropertyClosure = {
      id: "closure-1",
      propertyId: "property-1",
      roomTypeId: "room-type-1",
      startDate: "2026-06-01",
      endDate: "2026-06-02",
      reason: "Maintenance",
    };
    const updatedClosure: Partial<Omit<PropertyClosure, "id">> = {
      roomTypeId: undefined,
      startDate: "2026-06-01",
      endDate: "2026-06-03",
      reason: undefined,
    };

    const { result } = renderHook(() => useAppData());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.updatePropertyClosure(
        "closure-1",
        updatedClosure,
        existingClosure,
      );
    });

    expect(apiMock.updatePropertyClosureWithoutReturning).toHaveBeenCalledWith(
      "closure-1",
      updatedClosure,
    );
    expect(apiMock.updatePropertyClosure).not.toHaveBeenCalled();
    expect(logActivityMock).toHaveBeenCalledWith(
      expect.objectContaining({
        section: "settings",
        entityType: "property",
        entityId: "closure-1",
        entityLabel: "Closure 2026-06-01 – 2026-06-03",
        action: "property_closure_updated",
        details: "Updated blocked dates 2026-06-01 to 2026-06-03",
      }),
    );
  });

  it("updates property closures without returning rows when no local closure is available", async () => {
    pathnameState.value = "/admin/settings";
    const updatedClosure: Partial<Omit<PropertyClosure, "id">> = {
      propertyId: "property-1",
      roomTypeId: undefined,
      startDate: "2026-06-01",
      endDate: "2026-06-03",
      reason: undefined,
    };

    const { result } = renderHook(() => useAppData());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.updatePropertyClosure("closure-1", updatedClosure);
    });

    expect(apiMock.updatePropertyClosureWithoutReturning).toHaveBeenCalledWith(
      "closure-1",
      updatedClosure,
    );
    expect(apiMock.updatePropertyClosure).not.toHaveBeenCalled();
    expect(logActivityMock).toHaveBeenCalledWith(
      expect.objectContaining({
        section: "settings",
        entityType: "property",
        entityId: "closure-1",
        entityLabel: "Closure 2026-06-01 – 2026-06-03",
        action: "property_closure_updated",
        details: "Updated blocked dates 2026-06-01 to 2026-06-03",
      }),
    );
  });

  it("adds property closures by returning only the inserted id", async () => {
    pathnameState.value = "/admin/settings";
    const newClosure = {
      propertyId: "property-1",
      roomTypeId: undefined,
      startDate: "2026-06-01",
      endDate: "2026-06-03",
      reason: undefined,
    } satisfies Omit<PropertyClosure, "id">;

    const { result } = renderHook(() => useAppData());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let created: PropertyClosure | undefined;
    await act(async () => {
      created = await result.current.addPropertyClosure(newClosure);
    });

    expect(apiMock.addPropertyClosureIdOnly).toHaveBeenCalledWith(newClosure);
    expect(apiMock.addPropertyClosure).not.toHaveBeenCalled();
    expect(created).toEqual({ id: "closure-2", ...newClosure });
    expect(logActivityMock).toHaveBeenCalledWith(
      expect.objectContaining({
        section: "settings",
        entityType: "property",
        entityId: "closure-2",
        entityLabel: "Closure 2026-06-01 – 2026-06-03",
        action: "property_closure_created",
        details: "Blocked dates 2026-06-01 to 2026-06-03",
      }),
    );
  });

  it("updates roles without returning rows when an existing role is available", async () => {
    pathnameState.value = "/admin/settings";
    const existingRole: Role = {
      id: "role-1",
      name: "Manager",
      permissions: ["read:room"],
      hierarchyLevel: 1,
    };
    const updatedRole: Partial<Omit<Role, "id">> = {
      name: "Supervisor",
      permissions: ["read:room", "update:room"],
      hierarchyLevel: 2,
    };

    const { result } = renderHook(() => useAppData());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.updateRole("role-1", updatedRole, existingRole);
    });

    expect(apiMock.updateRoleWithoutReturning).toHaveBeenCalledWith(
      "role-1",
      updatedRole,
    );
    expect(apiMock.updateRole).not.toHaveBeenCalled();
    expect(logActivityMock).toHaveBeenCalledWith(
      expect.objectContaining({
        section: "roles",
        entityType: "role",
        entityId: "role-1",
        entityLabel: "Supervisor",
        action: "role_updated",
        details: "Updated role Supervisor",
        metadata: { changedFields: ["name", "permissions", "hierarchyLevel"] },
      }),
    );
  });

  it("updates roles without returning rows when no local role is available", async () => {
    pathnameState.value = "/admin/settings";
    const updatedRole: Partial<Omit<Role, "id">> = {
      name: "Supervisor",
      permissions: ["read:room", "update:room"],
      hierarchyLevel: 2,
    };

    const { result } = renderHook(() => useAppData());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.updateRole("role-1", updatedRole);
    });

    expect(apiMock.updateRoleWithoutReturning).toHaveBeenCalledWith(
      "role-1",
      updatedRole,
    );
    expect(apiMock.updateRole).not.toHaveBeenCalled();
    expect(logActivityMock).toHaveBeenCalledWith(
      expect.objectContaining({
        section: "roles",
        entityType: "role",
        entityId: "role-1",
        entityLabel: "Supervisor",
        action: "role_updated",
        details: "Updated role Supervisor",
        metadata: { changedFields: ["name", "permissions", "hierarchyLevel"] },
      }),
    );
  });

  it("adds roles by returning only the inserted id", async () => {
    pathnameState.value = "/admin/settings";
    const newRole = {
      name: "Supervisor",
      permissions: ["read:room", "update:room"],
      hierarchyLevel: 2,
    } satisfies Omit<Role, "id">;

    const { result } = renderHook(() => useAppData());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.addRole(newRole);
    });

    expect(apiMock.addRoleIdOnly).toHaveBeenCalledWith(newRole);
    expect(apiMock.addRole).not.toHaveBeenCalled();
    expect(logActivityMock).toHaveBeenCalledWith(
      expect.objectContaining({
        section: "roles",
        entityType: "role",
        entityId: "role-2",
        entityLabel: "Supervisor",
        action: "role_created",
        details: "Created role Supervisor",
        metadata: {
          permissions: ["read:room", "update:room"],
          hierarchyLevel: 2,
        },
      }),
    );
  });

  it("updates users without returning profile rows when an existing user is available", async () => {
    pathnameState.value = "/admin/settings";
    const existingUser: User = {
      id: "user-2",
      name: "Old User",
      email: "old@example.com",
      roleId: "role-1",
    };
    const updatedUser = {
      name: "New User",
      roleId: "role-2",
    };

    const { result } = renderHook(() => useAppData());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.updateUser("user-2", updatedUser, existingUser);
    });

    expect(apiMock.updateUserProfileWithoutReturning).toHaveBeenCalledWith(
      "user-2",
      updatedUser,
    );
    expect(apiMock.updateUserProfile).not.toHaveBeenCalled();
    expect(logActivityMock).toHaveBeenCalledWith(
      expect.objectContaining({
        section: "users",
        entityType: "user",
        entityId: "user-2",
        entityLabel: "New User",
        action: "user_updated",
        details: "Updated user New User",
        metadata: { changedFields: ["name", "roleId"] },
      }),
    );
  });

  it("updates users without returning profile rows when no local user is available", async () => {
    pathnameState.value = "/admin/settings";
    const updatedUser = {
      name: "New User",
      roleId: "role-2",
    };

    const { result } = renderHook(() => useAppData());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.updateUser("user-2", updatedUser);
    });

    expect(apiMock.updateUserProfileWithoutReturning).toHaveBeenCalledWith(
      "user-2",
      updatedUser,
    );
    expect(apiMock.updateUserProfile).not.toHaveBeenCalled();
    expect(logActivityMock).toHaveBeenCalledWith(
      expect.objectContaining({
        section: "users",
        entityType: "user",
        entityId: "user-2",
        entityLabel: "New User",
        action: "user_updated",
        details: "Updated user New User",
        metadata: { changedFields: ["name", "roleId"] },
      }),
    );
  });

  it("updates amenities without returning rows when an existing amenity is available", async () => {
    pathnameState.value = "/admin/settings";
    const existingAmenity = {
      id: "amenity-1",
      name: "Wifi",
      icon: "Wifi",
    };
    const updatedAmenity = {
      name: "High Speed Wi-Fi",
      icon: "Router",
    };

    const { result } = renderHook(() => useAppData());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.updateAmenity(
        "amenity-1",
        updatedAmenity,
        existingAmenity,
      );
    });

    expect(apiMock.updateAmenityWithoutReturning).toHaveBeenCalledWith(
      "amenity-1",
      updatedAmenity,
    );
    expect(apiMock.updateAmenity).not.toHaveBeenCalled();
    expect(logActivityMock).toHaveBeenCalledWith(
      expect.objectContaining({
        section: "amenities",
        entityType: "amenity",
        entityId: "amenity-1",
        entityLabel: "High Speed Wi-Fi",
        action: "amenity_updated",
        details: "Updated amenity High Speed Wi-Fi",
        metadata: { changedFields: ["name", "icon"] },
      }),
    );
  });

  it("updates amenities without returning rows when no local amenity is available", async () => {
    pathnameState.value = "/admin/settings";
    const updatedAmenity = {
      name: "High Speed Wi-Fi",
      icon: "Router",
    };

    const { result } = renderHook(() => useAppData());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.updateAmenity("amenity-1", updatedAmenity);
    });

    expect(apiMock.updateAmenityWithoutReturning).toHaveBeenCalledWith(
      "amenity-1",
      updatedAmenity,
    );
    expect(apiMock.updateAmenity).not.toHaveBeenCalled();
    expect(logActivityMock).toHaveBeenCalledWith(
      expect.objectContaining({
        section: "amenities",
        entityType: "amenity",
        entityId: "amenity-1",
        entityLabel: "High Speed Wi-Fi",
        action: "amenity_updated",
        details: "Updated amenity High Speed Wi-Fi",
        metadata: { changedFields: ["name", "icon"] },
      }),
    );
  });

  it("adds amenities by returning only the inserted id", async () => {
    pathnameState.value = "/admin/settings";
    const newAmenity = {
      name: "Free Wi-Fi",
      icon: "Wifi",
    } satisfies Omit<Amenity, "id">;

    const { result } = renderHook(() => useAppData());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.addAmenity(newAmenity);
    });

    expect(apiMock.addAmenityIdOnly).toHaveBeenCalledWith(newAmenity);
    expect(apiMock.addAmenity).not.toHaveBeenCalled();
    expect(logActivityMock).toHaveBeenCalledWith(
      expect.objectContaining({
        section: "amenities",
        entityType: "amenity",
        entityId: "amenity-2",
        entityLabel: "Free Wi-Fi",
        action: "amenity_created",
        details: "Created amenity Free Wi-Fi",
      }),
    );
  });

  it("adds sticky notes by returning only the inserted id", async () => {
    pathnameState.value = "/admin/dashboard";
    const newNote = {
      title: "Front desk",
      description: "Call guest at 9",
      color: "blue" as const,
    } satisfies Omit<StickyNote, "id" | "createdAt">;

    const { result } = renderHook(() => useAppData());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.addStickyNote(newNote);
    });

    expect(apiMock.addStickyNoteIdOnly).toHaveBeenCalledWith({
      ...newNote,
      user_id: "user-1",
    });
    expect(apiMock.addStickyNote).not.toHaveBeenCalled();
    expect(logActivityMock).toHaveBeenCalledWith(
      expect.objectContaining({
        section: "sticky_notes",
        entityType: "sticky_note",
        entityId: "note-2",
        entityLabel: "Front desk",
        action: "sticky_note_created",
        details: "Created note Front desk",
      }),
    );
  });

  it("updates sticky notes without returning rows when an existing note is available", async () => {
    pathnameState.value = "/admin/dashboard";
    const existingNote: StickyNote = {
      id: "note-1",
      title: "Front desk",
      description: "Call guest",
      color: "yellow",
      createdAt: "2026-05-13T00:00:00.000Z",
    };
    const updatedNote = {
      title: "Front desk follow-up",
      description: "Call guest at 9",
      color: "blue" as const,
    };

    const { result } = renderHook(() => useAppData());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.updateStickyNote("note-1", updatedNote, existingNote);
    });

    expect(apiMock.updateStickyNoteWithoutReturning).toHaveBeenCalledWith(
      "note-1",
      updatedNote,
    );
    expect(apiMock.updateStickyNote).not.toHaveBeenCalled();
    expect(logActivityMock).toHaveBeenCalledWith(
      expect.objectContaining({
        section: "sticky_notes",
        entityType: "sticky_note",
        entityId: "note-1",
        entityLabel: "Front desk follow-up",
        action: "sticky_note_updated",
        details: "Updated note Front desk follow-up",
        metadata: { changedFields: ["title", "description", "color"] },
      }),
    );
  });

  it("updates sticky notes without returning rows when no local note is available", async () => {
    pathnameState.value = "/admin/dashboard";
    const updatedNote = {
      title: "Front desk follow-up",
      description: "Call guest at 9",
      color: "blue" as const,
    };

    const { result } = renderHook(() => useAppData());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.updateStickyNote("note-1", updatedNote);
    });

    expect(apiMock.updateStickyNoteWithoutReturning).toHaveBeenCalledWith(
      "note-1",
      updatedNote,
    );
    expect(apiMock.updateStickyNote).not.toHaveBeenCalled();
    expect(logActivityMock).toHaveBeenCalledWith(
      expect.objectContaining({
        section: "sticky_notes",
        entityType: "sticky_note",
        entityId: "note-1",
        entityLabel: "Front desk follow-up",
        action: "sticky_note_updated",
        details: "Updated note Front desk follow-up",
        metadata: { changedFields: ["title", "description", "color"] },
      }),
    );
  });

  it("lets the public home page use its compact room preview API", async () => {
    pathnameState.value = "/";

    const { result } = renderHook(() => useAppData());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expectPublicPropertyFetch();
    expect(apiMock.getRoomTypes).not.toHaveBeenCalled();
    expect(apiMock.getRoomTypeAmenities).not.toHaveBeenCalled();
    expect(apiMock.getAmenities).not.toHaveBeenCalled();
    expect(apiMock.getRooms).not.toHaveBeenCalled();
    expect(apiMock.getRatePlans).not.toHaveBeenCalled();
    expect(apiMock.getSeasonalPrices).not.toHaveBeenCalled();
    expect(apiMock.getPropertyClosures).not.toHaveBeenCalled();
  });

  it("lets public room detail pages use their compact room detail API", async () => {
    pathnameState.value = "/book/rooms/room-type-1";

    const { result } = renderHook(() => useAppData());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expectPublicPropertyFetch();
    expect(apiMock.getRoomTypes).not.toHaveBeenCalled();
    expect(apiMock.getRoomTypeAmenities).not.toHaveBeenCalled();
    expect(apiMock.getAmenities).not.toHaveBeenCalled();
    expect(apiMock.getRooms).not.toHaveBeenCalled();
    expect(apiMock.getRatePlans).not.toHaveBeenCalled();
    expect(apiMock.getSeasonalPrices).not.toHaveBeenCalled();
    expect(apiMock.getPropertyClosures).not.toHaveBeenCalled();
  });

  it("lets the public booking search page use its compact search-data API", async () => {
    pathnameState.value = "/book";

    const { result } = renderHook(() => useAppData());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expectPublicPropertyFetch();
    expect(apiMock.getRoomTypes).not.toHaveBeenCalled();
    expect(apiMock.getRoomTypeAmenities).not.toHaveBeenCalled();
    expect(apiMock.getAmenities).not.toHaveBeenCalled();
    expect(apiMock.getRooms).not.toHaveBeenCalled();
    expect(apiMock.getRatePlans).not.toHaveBeenCalled();
    expect(apiMock.getSeasonalPrices).not.toHaveBeenCalled();
    expect(apiMock.getPropertyClosures).not.toHaveBeenCalled();
    expect(apiMock.getGuests).not.toHaveBeenCalled();
  });

  it("does not make the dashboard reservations startup request on the paginated reservations index", async () => {
    pathnameState.value = "/admin/reservations";

    const { result } = renderHook(() => useAppData());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(apiMock.getProperty).toHaveBeenCalledTimes(1);
    expect(apiMock.getGuests).not.toHaveBeenCalled();
    expect(apiMock.getRooms).not.toHaveBeenCalled();
    expect(apiMock.getRoomTypes).not.toHaveBeenCalled();

    expect(apiMock.getRatePlans).not.toHaveBeenCalled();
    expect(apiMock.getSeasonalPrices).not.toHaveBeenCalled();
    expect(authorizedFetchMock).not.toHaveBeenCalled();
    expect(apiMock.getReservations).not.toHaveBeenCalled();
  });

  it("lets the admin reservation creation form use route-backed reference data and date-scoped conflict checks", async () => {
    pathnameState.value = "/admin/reservations/new";

    const { result } = renderHook(() => useAppData());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(apiMock.getProperty).toHaveBeenCalledTimes(1);
    expect(apiMock.getGuests).not.toHaveBeenCalled();
    expect(apiMock.getRooms).not.toHaveBeenCalled();
    expect(apiMock.getRoomTypes).not.toHaveBeenCalled();
    expect(apiMock.getRatePlans).not.toHaveBeenCalled();
    expect(apiMock.getSeasonalPrices).not.toHaveBeenCalled();

    expect(authorizedFetchMock).not.toHaveBeenCalled();
    expect(apiMock.getReservations).not.toHaveBeenCalled();
  });

  it("loads reservation detail lookups through the admin booking API", async () => {
    pathnameState.value = "/admin/reservations/reservation-1";
    authorizedFetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: {
            reservations: [
              {
                id: "reservation-1",
                bookingId: "A1001",
                guestId: "guest-1",
                roomId: "room-1",
                ratePlanId: "rate-plan-1",
                checkInDate: "2026-06-10",
                checkOutDate: "2026-06-12",
                numberOfGuests: 2,
                status: "Confirmed",
                folio: [],
                totalAmount: 2000,
                bookingDate: "2026-05-13T00:00:00.000Z",
                source: "reception",
                paymentMethod: "UPI",
                adultCount: 2,
                childCount: 0,
                taxEnabledSnapshot: true,
                taxRateSnapshot: 0.12,
              },
            ],
            guest: {
              id: "guest-1",
              firstName: "Nirav",
              lastName: "Patel",
              email: "nirav@example.com",
              phone: "+91 9999999999",
            },
            rooms: [{ id: "room-1", roomNumber: "101", roomTypeId: "type-1", status: "Clean" }],
            roomTypes: [
              {
                id: "type-1",
                name: "Ganga View",
                description: "",
                maxOccupancy: 2,
                bedTypes: ["Queen"],
                price: 1000,
                amenities: [],
                photos: [],
                isVisible: true,
              },
            ],
            ratePlans: [{ id: "rate-plan-1", name: "Standard Rate", price: 1000, rules: { minStay: 1, cancellationPolicy: "" } }],
          },
        }),
        { status: 200 },
      ),
    );

    const { result } = renderHook(() => useAppData());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(apiMock.getGuests).not.toHaveBeenCalled();
    expect(apiMock.getProperty).toHaveBeenCalledTimes(1);
    expect(apiMock.getRooms).not.toHaveBeenCalled();
    expect(apiMock.getRoomTypes).not.toHaveBeenCalled();
    expect(apiMock.getRatePlans).not.toHaveBeenCalled();
    expect(apiMock.getSeasonalPrices).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.loadBookingDetails("reservation-1");
    });

    expect(authorizedFetchMock).toHaveBeenCalledWith(
      "/api/admin/reservations/reservation-1/booking",
      { cache: "no-store" },
    );
    expect(apiMock.getReservationById).not.toHaveBeenCalled();
    expect(apiMock.getGuestById).not.toHaveBeenCalled();
    expect(apiMock.getReservationsByBookingId).not.toHaveBeenCalled();
    expect(result.current.activeBookingReservations).toHaveLength(1);
    expect(result.current.activeBookingRooms.map((room) => room.id)).toEqual(["room-1"]);
    expect(result.current.activeBookingRoomTypes.map((roomType) => roomType.id)).toEqual(["type-1"]);
    expect(result.current.activeBookingRatePlans.map((ratePlan) => ratePlan.id)).toEqual(["rate-plan-1"]);
    expect(result.current.guests.map((guest) => guest.id)).toContain("guest-1");
  });

  it("updates active booking reservations without returning rows when local data is available", async () => {
    pathnameState.value = "/admin/reservations/reservation-1";
    authorizedFetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: {
            reservations: [makeReservation()],
            guest: {
              id: "guest-1",
              firstName: "Nirav",
              lastName: "Patel",
              email: "nirav@example.com",
              phone: "+91 9999999999",
            },
            rooms: [],
            roomTypes: [],
            ratePlans: [],
          },
        }),
        { status: 200 },
      ),
    );

    const { result } = renderHook(() => useAppData());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.loadBookingDetails("reservation-1");
    });

    await waitFor(() => expect(result.current.activeBookingReservations).toHaveLength(1));

    await act(async () => {
      await result.current.updateReservation("reservation-1", {
        status: "Checked-in",
        notes: undefined,
      });
    });

    expect(apiMock.updateReservationWithoutReturning).toHaveBeenCalledWith(
      "reservation-1",
      {
        status: "Checked-in",
        notes: undefined,
      },
    );
    expect(apiMock.updateReservation).not.toHaveBeenCalled();
    expect(result.current.activeBookingReservations[0]).toMatchObject({
      id: "reservation-1",
      bookingId: "A1001",
      status: "Checked-in",
      notes: "Keep pillow",
    });
    expect(logActivityMock).toHaveBeenCalledWith(
      expect.objectContaining({
        section: "reservations",
        entityType: "reservation",
        entityId: "reservation-1",
        entityLabel: "A1001",
        action: "reservation_updated",
        details: "Updated reservation A1001",
        metadata: { changedFields: ["status"] },
      }),
    );
  });

  it("updates reservations without returning rows when no local reservation is available", async () => {
    const updatedReservation: Partial<Omit<Reservation, "id">> = {
      bookingId: "BK-404",
      status: "Checked-in",
    };

    const { result } = renderHook(() => useAppData());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.updateReservation("reservation-404", updatedReservation);
    });

    expect(apiMock.updateReservationWithoutReturning).toHaveBeenCalledWith(
      "reservation-404",
      updatedReservation,
    );
    expect(apiMock.updateReservation).not.toHaveBeenCalled();
    expect(logActivityMock).toHaveBeenCalledWith(
      expect.objectContaining({
        section: "reservations",
        entityType: "reservation",
        entityId: "reservation-404",
        entityLabel: "BK-404",
        action: "reservation_updated",
        details: "Updated reservation BK-404",
        metadata: { changedFields: ["bookingId", "status"] },
      }),
    );
  });

  it("updates known booking reservation statuses without returning rows", async () => {
    pathnameState.value = "/admin/reservations/reservation-1";
    authorizedFetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: {
            reservations: [
              makeReservation(),
              makeReservation({
                id: "reservation-2",
                roomId: "room-2",
                status: "Confirmed",
              }),
            ],
            guest: {
              id: "guest-1",
              firstName: "Nirav",
              lastName: "Patel",
              email: "nirav@example.com",
              phone: "+91 9999999999",
            },
            rooms: [],
            roomTypes: [],
            ratePlans: [],
          },
        }),
        { status: 200 },
      ),
    );

    const { result } = renderHook(() => useAppData());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.loadBookingDetails("reservation-1");
    });

    await waitFor(() => expect(result.current.activeBookingReservations).toHaveLength(2));

    await act(async () => {
      await result.current.updateBookingReservationStatus("A1001", "Cancelled");
    });

    expect(apiMock.updateBookingReservationsStatusWithoutReturning).toHaveBeenCalledWith(
      "A1001",
      "Cancelled",
    );
    expect(apiMock.updateBookingReservationsStatus).not.toHaveBeenCalled();
    expect(result.current.activeBookingReservations.map(({ id, status }) => ({
      id,
      status,
    }))).toEqual([
      { id: "reservation-1", status: "Cancelled" },
      { id: "reservation-2", status: "Cancelled" },
    ]);
    expect(logActivityMock).toHaveBeenCalledWith(
      expect.objectContaining({
        section: "reservations",
        entityType: "reservation",
        entityId: "A1001",
        entityLabel: "A1001",
        action: "reservation_status_updated",
        details: "Changed booking A1001 status to Cancelled for 2 rooms",
        metadata: { status: "Cancelled", bookingId: "A1001", affectedReservations: 2 },
      }),
    );
  });

  it("updates booking reservation statuses without returning rows when no local reservations are available", async () => {
    apiMock.updateBookingReservationsStatusWithoutReturning.mockResolvedValueOnce({
      data: null,
      error: null,
      count: 2,
    });

    const { result } = renderHook(() => useAppData());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.updateBookingReservationStatus("BK-404", "Cancelled");
    });

    expect(apiMock.updateBookingReservationsStatusWithoutReturning).toHaveBeenCalledWith(
      "BK-404",
      "Cancelled",
    );
    expect(apiMock.updateBookingReservationsStatus).not.toHaveBeenCalled();
    expect(logActivityMock).toHaveBeenCalledWith(
      expect.objectContaining({
        section: "reservations",
        entityType: "reservation",
        entityId: "BK-404",
        entityLabel: "BK-404",
        action: "reservation_status_updated",
        details: "Changed booking BK-404 status to Cancelled for 2 rooms",
        metadata: { status: "Cancelled", bookingId: "BK-404", affectedReservations: 2 },
      }),
    );
  });

  it("adds folio items by returning only the inserted id and server timestamp", async () => {
    pathnameState.value = "/admin/reservations/reservation-1";
    authorizedFetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: {
            reservations: [makeReservation()],
            guest: {
              id: "guest-1",
              firstName: "Nirav",
              lastName: "Patel",
              email: "nirav@example.com",
              phone: "+91 9999999999",
            },
            rooms: [],
            roomTypes: [],
            ratePlans: [],
          },
        }),
        { status: 200 },
      ),
    );
    const newItem = {
      description: "Spa charge",
      amount: 500,
      paymentMethod: "Cash",
      transactionId: "txn-1",
    } satisfies Omit<FolioItem, "id" | "timestamp">;

    const { result } = renderHook(() => useAppData());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.loadBookingDetails("reservation-1");
    });

    await waitFor(() => expect(result.current.activeBookingReservations).toHaveLength(1));

    await act(async () => {
      await result.current.addFolioItem("reservation-1", newItem);
    });

    expect(apiMock.addFolioItemIdAndTimestamp).toHaveBeenCalledWith({
      reservation_id: "reservation-1",
      description: "Spa charge",
      amount: 500,
      payment_method: "Cash",
      transaction_id: "txn-1",
      external_source: undefined,
      external_reference: null,
      external_metadata: undefined,
    });
    expect(apiMock.addFolioItem).not.toHaveBeenCalled();
    expect(result.current.activeBookingReservations[0].folio).toEqual([
      {
        id: "folio-2",
        description: "Spa charge",
        amount: 500,
        timestamp: "2026-05-14T16:30:00.000Z",
        paymentMethod: "Cash",
        transactionId: "txn-1",
        externalSource: "internal",
        externalMetadata: {},
      },
    ]);
    expect(logActivityMock).toHaveBeenCalledWith(
      expect.objectContaining({
        section: "reservations",
        entityType: "reservation",
        entityId: "reservation-1",
        entityLabel: "reservation-1",
        action: "reservation_charge_added",
        details: "Added charge Spa charge",
        amountMinor: 50000,
        metadata: { description: "Spa charge", paymentMethod: "Cash" },
      }),
    );
  });

  it("normalizes created room occupancies without returning reservation rows", async () => {
    pathnameState.value = "/admin/reservations/new";
    const createdReservations = [
      {
        id: "reservation-1",
        bookingId: "A1001",
        roomId: "room-1",
        totalAmount: 2000,
        bookingDate: "2026-05-13T00:00:00.000Z",
      },
      {
        id: "reservation-2",
        bookingId: "A1001",
        roomId: "room-2",
        totalAmount: 2000,
        bookingDate: "2026-05-13T00:00:00.000Z",
      },
    ];
    apiMock.createReservationsWithTotalMinimal.mockResolvedValueOnce({
      data: createdReservations,
      error: null,
    });

    const { result } = renderHook(() => useAppData());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let savedReservations: Reservation[] = [];
    await act(async () => {
      savedReservations = await result.current.addReservation({
        guestId: "guest-1",
        roomIds: ["room-1", "room-2"],
        roomOccupancies: [
          { roomId: "room-1", adults: 1, children: 0 },
          { roomId: "room-2", adults: 2, children: 1 },
        ],
        ratePlanId: "rate-plan-1",
        checkInDate: "2026-06-10",
        checkOutDate: "2026-06-12",
        numberOfGuests: 3,
        adultCount: 3,
        childCount: 1,
        status: "Confirmed",
        bookingDate: "2026-05-13T00:00:00.000Z",
        source: "reception",
        paymentMethod: "UPI",
      });
    });

    expect(apiMock.createReservationsWithTotalMinimal).toHaveBeenCalledWith(
      expect.objectContaining({
        p_booking_id: null,
        p_guest_id: "guest-1",
        p_room_ids: ["room-1", "room-2"],
        p_rate_plan_id: "rate-plan-1",
        p_check_in_date: "2026-06-10",
        p_check_out_date: "2026-06-12",
        p_number_of_guests: 3,
        p_status: "Confirmed",
        p_booking_date: "2026-05-13T00:00:00.000Z",
        p_source: "reception",
        p_payment_method: "UPI",
        p_adult_count: 3,
        p_child_count: 1,
      }),
    );
    expect(apiMock.createReservationsWithTotal).not.toHaveBeenCalled();
    expect(apiMock.updateReservationWithoutReturning).toHaveBeenNthCalledWith(
      1,
      "reservation-1",
      {
        adultCount: 1,
        childCount: 0,
        numberOfGuests: 1,
      },
    );
    expect(apiMock.updateReservationWithoutReturning).toHaveBeenNthCalledWith(
      2,
      "reservation-2",
      {
        adultCount: 2,
        childCount: 1,
        numberOfGuests: 3,
      },
    );
    expect(apiMock.updateReservation).not.toHaveBeenCalled();
    expect(savedReservations.map(({ id, adultCount, childCount, numberOfGuests }) => ({
      id,
      adultCount,
      childCount,
      numberOfGuests,
    }))).toEqual([
      { id: "reservation-1", adultCount: 1, childCount: 0, numberOfGuests: 1 },
      { id: "reservation-2", adultCount: 2, childCount: 1, numberOfGuests: 3 },
    ]);
  });

  it("loads reservation edit data without full startup reference data", async () => {
    pathnameState.value = "/admin/reservations/reservation-1/edit";

    const { result } = renderHook(() => useAppData());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(apiMock.getProperty).toHaveBeenCalledTimes(1);
    expect(apiMock.getGuests).not.toHaveBeenCalled();
    expect(apiMock.getRooms).not.toHaveBeenCalled();
    expect(apiMock.getRoomTypes).not.toHaveBeenCalled();
    expect(apiMock.getRatePlans).not.toHaveBeenCalled();
    expect(apiMock.getSeasonalPrices).not.toHaveBeenCalled();
    expect(authorizedFetchMock).not.toHaveBeenCalled();
    expect(apiMock.getReservations).not.toHaveBeenCalled();
  });

  it("lets the public booking review route use selected-room review data", async () => {
    pathnameState.value = "/book/review";

    const { result } = renderHook(() => useAppData());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expectPublicPropertyFetch();
    expect(apiMock.getRoomTypes).not.toHaveBeenCalled();
    expect(apiMock.getRatePlans).not.toHaveBeenCalled();
    expect(apiMock.getSeasonalPrices).not.toHaveBeenCalled();
    expect(apiMock.getPropertyClosures).not.toHaveBeenCalled();
    expect(apiMock.getRooms).not.toHaveBeenCalled();
    expect(apiMock.getAmenities).not.toHaveBeenCalled();
    expect(apiMock.getGuests).not.toHaveBeenCalled();
    expect(apiMock.getReservations).not.toHaveBeenCalled();
  });

  it("uses route-backed data on the public booking confirmation route", async () => {
    pathnameState.value = "/book/confirmation/reservation-1";

    const { result } = renderHook(() => useAppData());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expectPublicPropertyFetch();
    expect(apiMock.getRooms).not.toHaveBeenCalled();
    expect(apiMock.getRoomTypes).not.toHaveBeenCalled();

    expect(apiMock.getRatePlans).not.toHaveBeenCalled();
    expect(apiMock.getSeasonalPrices).not.toHaveBeenCalled();
    expect(apiMock.getPropertyClosures).not.toHaveBeenCalled();
    expect(apiMock.getAmenities).not.toHaveBeenCalled();
    expect(apiMock.getGuests).not.toHaveBeenCalled();
    expect(apiMock.getReservations).not.toHaveBeenCalled();
  });
});

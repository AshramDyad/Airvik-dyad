import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const supabaseMock = vi.hoisted(() => ({
  from: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: supabaseMock,
}));

import {
  AMENITY_SELECT_COLUMNS,
  ADMIN_ACTIVITY_LOG_SELECT_COLUMNS,
  BOOKING_RESTRICTION_SELECT_COLUMNS,
  CATEGORY_SELECT_COLUMNS,
  getAdminActivityLogs,
  getBookingRestrictions,
  getCategories,
  getHousekeepingAssignments,
  getAmenities,
  getProperty,
  getReservationById,
  getReservationsPage,
  getRatePlans,
  getRoles,
  getRoomCategories,
  getRoomTypeWithAmenities,
  getRoomTypeAmenities,
  getRoomTypes,
  getPropertyClosures,
  getSeasonalPrices,
  getStickyNotes,
  getUserProfile,
  HOUSEKEEPING_ASSIGNMENT_SELECT_COLUMNS,
  createCategoryIdOnly,
  createPostWithoutReturning,
  addRoomCategoryIdOnly,
  addRoomIdOnly,
  addRatePlanIdOnly,
  addSeasonalPriceIdOnly,
  addRoleIdOnly,
  addAmenityIdOnly,
  addStickyNoteIdOnly,
  addPropertyClosureIdOnly,
  updateCategoryWithoutReturning,
  updateAmenityWithoutReturning,
  updateBookingReservationsStatusWithoutReturning,
  updateGuestWithoutReturning,
  updatePostWithoutReturning,
  updatePropertyWithoutReturning,
  updatePropertyClosureWithoutReturning,
  updateUserProfileWithoutReturning,
  updateReservation,
  updateReservationWithoutReturning,
  updateRoomWithoutReturning,
  updateRoomCategoryWithoutReturning,
  updateRoleWithoutReturning,
  updateRatePlanWithoutReturning,
  updateSeasonalPriceWithoutReturning,
  updateStickyNoteWithoutReturning,
  uploadFile,
  PROPERTY_SELECT_COLUMNS,
  RATE_PLAN_SELECT_COLUMNS,
  RESERVATION_SELECT_COLUMNS,
  ROLE_SELECT_COLUMNS,
  ROOM_CATEGORY_SELECT_COLUMNS,
  ROOM_TYPE_AMENITY_SELECT_COLUMNS,
  ROOM_TYPE_SELECT_COLUMNS,
  ROOM_TYPE_WITH_AMENITIES_SELECT_COLUMNS,
  PROPERTY_CLOSURE_SELECT_COLUMNS,
  SEASONAL_PRICE_SELECT_COLUMNS,
  STICKY_NOTE_SELECT_COLUMNS,
  USER_PROFILE_SELECT_COLUMNS,
} from "./index";

const createQuery = (response: unknown = { data: [], error: null }) => {
  const query = {
    delete: vi.fn(() => query),
    insert: vi.fn(() => query),
    update: vi.fn(() => query),
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    gte: vi.fn(() => query),
    lte: vi.fn(() => query),
    limit: vi.fn(() => query),
    single: vi.fn(async () => response),
    order: vi.fn(() => query),
    range: vi.fn(() => query),
    then: (resolve: (value: unknown) => unknown) => Promise.resolve(response).then(resolve),
  };
  return query;
};

const reservationRow = {
  id: "reservation-1",
  booking_id: "BK-1",
  guest_id: "guest-1",
  room_id: "room-1",
  rate_plan_id: "rate-1",
  check_in_date: "2026-05-13",
  check_out_date: "2026-05-14",
  number_of_guests: 2,
  status: "Confirmed",
  notes: null,
  total_amount: 1000,
  booking_date: "2026-05-12T00:00:00.000Z",
  source: "reception",
  payment_method: "Cash",
  adult_count: 2,
  child_count: 0,
  tax_enabled_snapshot: true,
  tax_rate_snapshot: 0.12,
  external_source: null,
  external_id: null,
  external_metadata: null,
  folio: [],
  guest: {
    first_name: "Asha",
    last_name: "Guest",
    email: "asha@example.com",
    phone: "555",
  },
};

describe("client API query shape", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("getProperty selects the full explicit property shape with aliases", async () => {
    const query = createQuery({
      data: {
        id: "property-1",
        name: "Airvik",
        address: "Rishikesh",
        phone: "555",
        email: "hello@example.com",
        logo_url: "/logo.svg",
        photos: [],
        google_maps_url: "https://maps.example",
        timezone: "Asia/Kolkata",
        currency: "INR",
        allowSameDayTurnover: true,
        showPartialDays: true,
        defaultUnitsView: "remaining",
        tax_enabled: true,
        tax_percentage: 0.12,
      },
      error: null,
    });
    supabaseMock.from.mockReturnValue(query);

    const result = await getProperty();

    expect(supabaseMock.from).toHaveBeenCalledWith("properties");
    expect(query.select).toHaveBeenCalledWith(PROPERTY_SELECT_COLUMNS);
    expect(query.limit).toHaveBeenCalledWith(1);
    expect(query.single).toHaveBeenCalledTimes(1);
    expect(result.data?.allowSameDayTurnover).toBe(true);
  });

  it("property update commands can avoid returned rows when the caller can merge locally", async () => {
    const query = createQuery({ data: null, error: null });
    supabaseMock.from.mockReturnValue(query);

    await updatePropertyWithoutReturning("property-1", {
      name: "Airvik Retreat",
      currency: "INR",
      tax_enabled: true,
      tax_percentage: 0.12,
    });

    expect(supabaseMock.from).toHaveBeenCalledWith("properties");
    expect(query.update).toHaveBeenCalledWith({
      name: "Airvik Retreat",
      currency: "INR",
      tax_enabled: true,
      tax_percentage: 0.12,
    });
    expect(query.eq).toHaveBeenCalledWith("id", "property-1");
    expect(query.select).not.toHaveBeenCalled();
    expect(query.single).not.toHaveBeenCalled();
  });

  it("shared lookup readers avoid wildcard selects", () => {
    const query = createQuery();
    supabaseMock.from.mockReturnValue(query);

    getRoomTypes();
    expect(supabaseMock.from).toHaveBeenLastCalledWith("room_types");
    expect(query.select).toHaveBeenLastCalledWith(ROOM_TYPE_SELECT_COLUMNS);

    getRoomCategories();
    expect(supabaseMock.from).toHaveBeenLastCalledWith("room_categories");
    expect(query.select).toHaveBeenLastCalledWith(ROOM_CATEGORY_SELECT_COLUMNS);

    getRatePlans();
    expect(supabaseMock.from).toHaveBeenLastCalledWith("rate_plans");
    expect(query.select).toHaveBeenLastCalledWith(RATE_PLAN_SELECT_COLUMNS);

    getAmenities();
    expect(supabaseMock.from).toHaveBeenLastCalledWith("amenities");
    expect(query.select).toHaveBeenLastCalledWith(AMENITY_SELECT_COLUMNS);
  });

  it("secondary admin startup readers avoid wildcard selects", async () => {
    const query = createQuery({ data: [], error: null });
    supabaseMock.from.mockReturnValue(query);

    getRoomTypeAmenities();
    expect(supabaseMock.from).toHaveBeenLastCalledWith("room_type_amenities");
    expect(query.select).toHaveBeenLastCalledWith(ROOM_TYPE_AMENITY_SELECT_COLUMNS);

    getRoles();
    expect(supabaseMock.from).toHaveBeenLastCalledWith("roles");
    expect(query.select).toHaveBeenLastCalledWith(ROLE_SELECT_COLUMNS);

    getStickyNotes("user-1");
    expect(supabaseMock.from).toHaveBeenLastCalledWith("sticky_notes");
    expect(query.select).toHaveBeenLastCalledWith(STICKY_NOTE_SELECT_COLUMNS);
    expect(query.eq).toHaveBeenLastCalledWith("user_id", "user-1");

    getHousekeepingAssignments("2026-05-13");
    expect(supabaseMock.from).toHaveBeenLastCalledWith("housekeeping_assignments");
    expect(query.select).toHaveBeenLastCalledWith(HOUSEKEEPING_ASSIGNMENT_SELECT_COLUMNS);
    expect(query.eq).toHaveBeenLastCalledWith("date", "2026-05-13");

    await getSeasonalPrices();
    expect(supabaseMock.from).toHaveBeenLastCalledWith("seasonal_prices");
    expect(query.select).toHaveBeenLastCalledWith(SEASONAL_PRICE_SELECT_COLUMNS);
    expect(query.order).toHaveBeenLastCalledWith("start_date");

    await getBookingRestrictions();
    expect(supabaseMock.from).toHaveBeenLastCalledWith("booking_restrictions");
    expect(query.select).toHaveBeenLastCalledWith(BOOKING_RESTRICTION_SELECT_COLUMNS);
    expect(query.order).toHaveBeenLastCalledWith("created_at");

    await getPropertyClosures();
    expect(supabaseMock.from).toHaveBeenLastCalledWith("property_closures");
    expect(query.select).toHaveBeenLastCalledWith(PROPERTY_CLOSURE_SELECT_COLUMNS);
    expect(query.order).toHaveBeenLastCalledWith("start_date");
  });

  it("housekeeping assignment reads stay scoped to a single date", () => {
    const query = createQuery({ data: [], error: null });
    supabaseMock.from.mockReturnValue(query);

    getHousekeepingAssignments("2026-05-13");

    expect(supabaseMock.from).toHaveBeenCalledWith("housekeeping_assignments");
    expect(query.select).toHaveBeenCalledWith(HOUSEKEEPING_ASSIGNMENT_SELECT_COLUMNS);
    expect(query.eq).toHaveBeenCalledWith("date", "2026-05-13");
  });

  it("activity log pagination uses exact columns and keeps filters server-side", async () => {
    const query = createQuery({ data: [], error: null, count: 0 });
    supabaseMock.from.mockReturnValue(query);

    await getAdminActivityLogs({
      section: "reservations",
      actorRole: "manager",
      from: "2026-05-01T00:00:00.000Z",
      to: "2026-05-31T23:59:59.999Z",
      limit: 25,
      page: 2,
    });

    expect(supabaseMock.from).toHaveBeenCalledWith("admin_activity_logs");
    expect(query.select).toHaveBeenCalledWith(ADMIN_ACTIVITY_LOG_SELECT_COLUMNS, {
      count: "exact",
    });
    expect(query.range).toHaveBeenCalledWith(25, 49);
    expect(query.eq).toHaveBeenCalledWith("section", "reservations");
    expect(query.eq).toHaveBeenCalledWith("actor_role", "manager");
    expect(query.gte).toHaveBeenCalledWith(
      "created_at",
      "2026-05-01T00:00:00.000Z"
    );
    expect(query.lte).toHaveBeenCalledWith(
      "created_at",
      "2026-05-31T23:59:59.999Z"
    );
  });

  it("getCategories performs one exact query", async () => {
    const query = createQuery({ data: [], error: null });
    supabaseMock.from.mockReturnValue(query);

    await getCategories();

    expect(supabaseMock.from).toHaveBeenCalledTimes(1);
    expect(supabaseMock.from).toHaveBeenCalledWith("categories");
    expect(query.select).toHaveBeenCalledWith(CATEGORY_SELECT_COLUMNS);
    expect(query.order).toHaveBeenCalledWith("name");
  });

  it("category update commands can avoid returned rows while preserving column mapping", async () => {
    if (typeof updateCategoryWithoutReturning !== "function") {
      expect(updateCategoryWithoutReturning).toBeTypeOf("function");
      return;
    }

    const query = createQuery({ data: null, error: null });
    supabaseMock.from.mockReturnValue(query);

    await updateCategoryWithoutReturning("category-1", {
      name: "News",
      slug: "news",
      description: "Latest updates",
      parent_id: "parent-1",
    });

    expect(supabaseMock.from).toHaveBeenCalledWith("categories");
    expect(query.update).toHaveBeenCalledWith({
      name: "News",
      slug: "news",
      description: "Latest updates",
      parent_id: "parent-1",
    });
    expect(query.eq).toHaveBeenCalledWith("id", "category-1");
    expect(query.select).not.toHaveBeenCalled();
    expect(query.single).not.toHaveBeenCalled();
  });

  it("category create commands return only the inserted id needed for local state", async () => {
    if (typeof createCategoryIdOnly !== "function") {
      expect(createCategoryIdOnly).toBeTypeOf("function");
      return;
    }

    const query = createQuery({ data: { id: "category-1" }, error: null });
    supabaseMock.from.mockReturnValue(query);

    const categoryId = await createCategoryIdOnly({
      name: "News",
      slug: "news",
      description: "Latest updates",
      parent_id: "parent-1",
    });

    expect(categoryId).toBe("category-1");
    expect(supabaseMock.from).toHaveBeenCalledWith("categories");
    expect(query.insert).toHaveBeenCalledWith([
      {
        name: "News",
        slug: "news",
        description: "Latest updates",
        parent_id: "parent-1",
      },
    ]);
    expect(query.select).toHaveBeenCalledWith("id");
    expect(query.select).not.toHaveBeenCalledWith(CATEGORY_SELECT_COLUMNS);
    expect(query.single).toHaveBeenCalledTimes(1);
  });

  it("post update commands can avoid returned rows while preserving category sync", async () => {
    if (typeof updatePostWithoutReturning !== "function") {
      expect(updatePostWithoutReturning).toBeTypeOf("function");
      return;
    }

    const postQuery = createQuery({ data: null, error: null });
    const deleteCategoriesQuery = createQuery({ data: null, error: null });
    const insertCategoriesQuery = createQuery({ data: null, error: null });
    supabaseMock.from
      .mockReturnValueOnce(postQuery)
      .mockReturnValueOnce(deleteCategoriesQuery)
      .mockReturnValueOnce(insertCategoriesQuery);

    await updatePostWithoutReturning("post-1", {
      title: "Ganga Retreat",
      slug: "ganga-retreat",
      content: "",
      excerpt: "Latest retreat",
      featured_image: "/retreat.jpg",
      status: "published",
      categoryIds: ["category-1", "category-2"],
    });

    expect(supabaseMock.from).toHaveBeenNthCalledWith(1, "posts");
    expect(postQuery.update).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Ganga Retreat",
        slug: "ganga-retreat",
        content: "",
        excerpt: "Latest retreat",
        featured_image: "/retreat.jpg",
        status: "published",
        updated_at: expect.any(String),
        published_at: expect.any(String),
      }),
    );
    expect(postQuery.eq).toHaveBeenCalledWith("id", "post-1");
    expect(postQuery.select).not.toHaveBeenCalled();
    expect(postQuery.single).not.toHaveBeenCalled();
    expect(supabaseMock.from).toHaveBeenNthCalledWith(2, "post_categories");
    expect(deleteCategoriesQuery.delete).toHaveBeenCalledTimes(1);
    expect(deleteCategoriesQuery.eq).toHaveBeenCalledWith("post_id", "post-1");
    expect(supabaseMock.from).toHaveBeenNthCalledWith(3, "post_categories");
    expect(insertCategoriesQuery.insert).toHaveBeenCalledWith([
      { post_id: "post-1", category_id: "category-1" },
      { post_id: "post-1", category_id: "category-2" },
    ]);
  });

  it("post create commands return only the inserted id needed for category sync", async () => {
    if (typeof createPostWithoutReturning !== "function") {
      expect(createPostWithoutReturning).toBeTypeOf("function");
      return;
    }

    const postQuery = createQuery({ data: { id: "post-1" }, error: null });
    const insertCategoriesQuery = createQuery({ data: null, error: null });
    supabaseMock.from
      .mockReturnValueOnce(postQuery)
      .mockReturnValueOnce(insertCategoriesQuery);

    await createPostWithoutReturning({
      title: "Ganga Retreat",
      slug: "ganga-retreat",
      content: "",
      excerpt: "Latest retreat",
      featured_image: "/retreat.jpg",
      status: "published",
      author_id: "user-1",
      categoryIds: ["category-1", "category-2"],
    });

    expect(supabaseMock.from).toHaveBeenNthCalledWith(1, "posts");
    expect(postQuery.insert).toHaveBeenCalledWith([
      expect.objectContaining({
        title: "Ganga Retreat",
        slug: "ganga-retreat",
        content: "",
        excerpt: "Latest retreat",
        featured_image: "/retreat.jpg",
        status: "published",
        author_id: "user-1",
        published_at: expect.any(String),
      }),
    ]);
    expect(postQuery.select).toHaveBeenCalledWith("id");
    expect(postQuery.single).toHaveBeenCalledTimes(1);
    expect(supabaseMock.from).toHaveBeenNthCalledWith(2, "post_categories");
    expect(insertCategoriesQuery.insert).toHaveBeenCalledWith([
      { post_id: "post-1", category_id: "category-1" },
      { post_id: "post-1", category_id: "category-2" },
    ]);
  });

  it("room type detail reads use exact room type and amenity columns", async () => {
    const query = createQuery({
      data: {
        id: "room-type-1",
        name: "Suite",
        description: "Suite",
        max_occupancy: 2,
        min_occupancy: 1,
        max_children: 0,
        category_id: null,
        bed_types: ["Queen"],
        price: 1000,
        photos: [],
        main_photo_url: null,
        is_visible: true,
        room_type_amenities: [],
      },
      error: null,
    });
    supabaseMock.from.mockReturnValue(query);

    await getRoomTypeWithAmenities("room-type-1");

    expect(supabaseMock.from).toHaveBeenCalledWith("room_types");
    expect(query.select).toHaveBeenCalledWith(ROOM_TYPE_WITH_AMENITIES_SELECT_COLUMNS);
    expect(query.eq).toHaveBeenCalledWith("id", "room-type-1");
    expect(query.single).toHaveBeenCalledTimes(1);
  });

  it("user profile reads use exact profile and role columns", () => {
    const query = createQuery();
    supabaseMock.from.mockReturnValue(query);

    getUserProfile("user-1");

    expect(supabaseMock.from).toHaveBeenCalledWith("profiles");
    expect(query.select).toHaveBeenCalledWith(USER_PROFILE_SELECT_COLUMNS);
    expect(query.eq).toHaveBeenCalledWith("id", "user-1");
    expect(query.single).toHaveBeenCalledTimes(1);
  });

  it("user profile update commands can avoid returned rows while preserving role mapping", async () => {
    const query = createQuery({ data: null, error: null });
    supabaseMock.from.mockReturnValue(query);

    await updateUserProfileWithoutReturning("user-1", {
      name: "Nirav",
      roleId: "role-2",
    });

    expect(supabaseMock.from).toHaveBeenCalledWith("profiles");
    expect(query.update).toHaveBeenCalledWith({
      name: "Nirav",
      role_id: "role-2",
    });
    expect(query.eq).toHaveBeenCalledWith("id", "user-1");
    expect(query.select).not.toHaveBeenCalled();
    expect(query.single).not.toHaveBeenCalled();
  });

  it("reservation readers use explicit reservation, guest, and folio columns", async () => {
    const query = createQuery({ data: reservationRow, error: null });
    supabaseMock.from.mockReturnValue(query);

    await getReservationById("reservation-1");

    expect(supabaseMock.from).toHaveBeenCalledWith("reservations");
    expect(query.select).toHaveBeenCalledWith(RESERVATION_SELECT_COLUMNS);
    expect(query.eq).toHaveBeenCalledWith("id", "reservation-1");
    expect(query.single).toHaveBeenCalledTimes(1);
  });

  it("reservation page queries use explicit columns with estimated count only when requested", async () => {
    const query = createQuery({
      data: [reservationRow],
      error: null,
      status: 200,
      statusText: "OK",
      count: 1,
    });
    supabaseMock.from.mockReturnValue(query);

    await getReservationsPage({ limit: 25, offset: 50, includeCount: true });

    expect(query.select).toHaveBeenCalledWith(RESERVATION_SELECT_COLUMNS, {
      count: "estimated",
    });
    expect(query.range).toHaveBeenCalledWith(50, 74);
  });

  it("reservation mutations return only the mapped reservation shape", async () => {
    const query = createQuery({ data: reservationRow, error: null });
    supabaseMock.from.mockReturnValue(query);

    await updateReservation("reservation-1", { status: "Checked-in" });

    expect(query.update).toHaveBeenCalledWith({ status: "Checked-in" });
    expect(query.eq).toHaveBeenCalledWith("id", "reservation-1");
    expect(query.select).toHaveBeenCalledWith(RESERVATION_SELECT_COLUMNS);
    expect(query.single).toHaveBeenCalledTimes(1);
  });

  it("reservation update commands can avoid returned rows while preserving column mapping", async () => {
    const query = createQuery({ data: null, error: null });
    supabaseMock.from.mockReturnValue(query);

    await updateReservationWithoutReturning("reservation-1", {
      adultCount: 2,
      childCount: 1,
      numberOfGuests: 3,
      externalMetadata: { removedFromBooking: true },
    });

    expect(supabaseMock.from).toHaveBeenCalledWith("reservations");
    expect(query.update).toHaveBeenCalledWith({
      adult_count: 2,
      child_count: 1,
      number_of_guests: 3,
      external_metadata: { removedFromBooking: true },
    });
    expect(query.eq).toHaveBeenCalledWith("id", "reservation-1");
    expect(query.select).not.toHaveBeenCalled();
    expect(query.single).not.toHaveBeenCalled();
  });

  it("booking status update commands can avoid returned reservation rows", async () => {
    if (typeof updateBookingReservationsStatusWithoutReturning !== "function") {
      expect(updateBookingReservationsStatusWithoutReturning).toBeTypeOf("function");
      return;
    }

    const query = createQuery({ data: null, error: null });
    supabaseMock.from.mockReturnValue(query);

    await updateBookingReservationsStatusWithoutReturning("A1001", "Cancelled");

    expect(supabaseMock.from).toHaveBeenCalledWith("reservations");
    expect(query.update).toHaveBeenCalledWith({ status: "Cancelled" });
    expect(query.eq).toHaveBeenCalledWith("booking_id", "A1001");
    expect(query.select).not.toHaveBeenCalled();
    expect(query.single).not.toHaveBeenCalled();
  });

  it("guest update commands can avoid returned rows while preserving guest column mapping", async () => {
    const query = createQuery({ data: null, error: null });
    supabaseMock.from.mockReturnValue(query);

    await updateGuestWithoutReturning("guest-1", {
      firstName: " Ravi ",
      lastName: "Kumar",
      email: "",
      phone: "999",
      city: "Rishikesh",
    });

    expect(supabaseMock.from).toHaveBeenCalledWith("guests");
    expect(query.update).toHaveBeenCalledWith({
      first_name: "Ravi",
      last_name: "Kumar",
      email: null,
      phone: "999",
      city: "Rishikesh",
    });
    expect(query.eq).toHaveBeenCalledWith("id", "guest-1");
    expect(query.select).not.toHaveBeenCalled();
    expect(query.single).not.toHaveBeenCalled();
  });

  it("room update commands can avoid returned rows when the caller can merge locally", async () => {
    const query = createQuery({ data: null, error: null });
    supabaseMock.from.mockReturnValue(query);

    await updateRoomWithoutReturning("room-1", { status: "Dirty" });

    expect(supabaseMock.from).toHaveBeenCalledWith("rooms");
    expect(query.update).toHaveBeenCalledWith({ status: "Dirty" });
    expect(query.eq).toHaveBeenCalledWith("id", "room-1");
    expect(query.select).not.toHaveBeenCalled();
    expect(query.single).not.toHaveBeenCalled();
  });

  it("room create commands return only the inserted id needed for local state", async () => {
    if (typeof addRoomIdOnly !== "function") {
      expect(addRoomIdOnly).toBeTypeOf("function");
      return;
    }

    const query = createQuery({ data: { id: "room-1" }, error: null });
    supabaseMock.from.mockReturnValue(query);

    const result = await addRoomIdOnly({
      roomNumber: "102",
      roomTypeId: "type-1",
      status: "Clean",
      photos: ["/room.jpg"],
    });

    expect(result.data).toBe("room-1");
    expect(supabaseMock.from).toHaveBeenCalledWith("rooms");
    expect(query.insert).toHaveBeenCalledWith([
      {
        room_number: "102",
        room_type_id: "type-1",
        status: "Clean",
        photos: ["/room.jpg"],
      },
    ]);
    expect(query.select).toHaveBeenCalledWith("id");
    expect(query.select).toHaveBeenCalledTimes(1);
    expect(query.single).toHaveBeenCalledTimes(1);
  });

  it("room category update commands can avoid returned rows when the caller can merge locally", async () => {
    const query = createQuery({ data: null, error: null });
    supabaseMock.from.mockReturnValue(query);

    await updateRoomCategoryWithoutReturning("category-1", {
      name: "Suites",
      description: "Suite rooms",
    });

    expect(supabaseMock.from).toHaveBeenCalledWith("room_categories");
    expect(query.update).toHaveBeenCalledWith({
      name: "Suites",
      description: "Suite rooms",
    });
    expect(query.eq).toHaveBeenCalledWith("id", "category-1");
    expect(query.select).not.toHaveBeenCalled();
    expect(query.single).not.toHaveBeenCalled();
  });

  it("room category create commands return only the inserted id needed for local state", async () => {
    if (typeof addRoomCategoryIdOnly !== "function") {
      expect(addRoomCategoryIdOnly).toBeTypeOf("function");
      return;
    }

    const query = createQuery({ data: { id: "category-1" }, error: null });
    supabaseMock.from.mockReturnValue(query);

    const result = await addRoomCategoryIdOnly({
      name: "Suites",
      description: "Suite rooms",
    });

    expect(result.data).toBe("category-1");
    expect(supabaseMock.from).toHaveBeenCalledWith("room_categories");
    expect(query.insert).toHaveBeenCalledWith([
      {
        name: "Suites",
        description: "Suite rooms",
      },
    ]);
    expect(query.select).toHaveBeenCalledWith("id");
    expect(query.select).not.toHaveBeenCalledWith(ROOM_CATEGORY_SELECT_COLUMNS);
    expect(query.single).toHaveBeenCalledTimes(1);
  });

  it("rate plan update commands can avoid returned rows when the caller can merge locally", async () => {
    const query = createQuery({ data: null, error: null });
    supabaseMock.from.mockReturnValue(query);

    await updateRatePlanWithoutReturning("rate-1", {
      name: "Flexible",
      price: 1200,
    });

    expect(supabaseMock.from).toHaveBeenCalledWith("rate_plans");
    expect(query.update).toHaveBeenCalledWith({
      name: "Flexible",
      price: 1200,
    });
    expect(query.eq).toHaveBeenCalledWith("id", "rate-1");
    expect(query.select).not.toHaveBeenCalled();
    expect(query.single).not.toHaveBeenCalled();
  });

  it("rate plan create commands return only the inserted id needed for local state", async () => {
    if (typeof addRatePlanIdOnly !== "function") {
      expect(addRatePlanIdOnly).toBeTypeOf("function");
      return;
    }

    const query = createQuery({ data: { id: "rate-1" }, error: null });
    supabaseMock.from.mockReturnValue(query);

    const result = await addRatePlanIdOnly({
      name: "Flexible",
      price: 1200,
      rules: {
        minStay: 1,
        cancellationPolicy: "Free cancellation",
      },
    });

    expect(result.data).toBe("rate-1");
    expect(supabaseMock.from).toHaveBeenCalledWith("rate_plans");
    expect(query.insert).toHaveBeenCalledWith([
      {
        name: "Flexible",
        price: 1200,
        rules: {
          minStay: 1,
          cancellationPolicy: "Free cancellation",
        },
      },
    ]);
    expect(query.select).toHaveBeenCalledWith("id");
    expect(query.select).not.toHaveBeenCalledWith(RATE_PLAN_SELECT_COLUMNS);
    expect(query.single).toHaveBeenCalledTimes(1);
  });

  it("role update commands can avoid returned rows while preserving role column mapping", async () => {
    const query = createQuery({ data: null, error: null });
    supabaseMock.from.mockReturnValue(query);

    await updateRoleWithoutReturning("role-1", {
      name: "Supervisor",
      permissions: ["read:room", "update:room"],
      hierarchyLevel: 2,
    });

    expect(supabaseMock.from).toHaveBeenCalledWith("roles");
    expect(query.update).toHaveBeenCalledWith({
      name: "Supervisor",
      permissions: ["read:room", "update:room"],
      hierarchy_level: 2,
    });
    expect(query.eq).toHaveBeenCalledWith("id", "role-1");
    expect(query.select).not.toHaveBeenCalled();
    expect(query.single).not.toHaveBeenCalled();
  });

  it("role create commands return only the inserted id needed for local state", async () => {
    if (typeof addRoleIdOnly !== "function") {
      expect(addRoleIdOnly).toBeTypeOf("function");
      return;
    }

    const query = createQuery({ data: { id: "role-1" }, error: null });
    supabaseMock.from.mockReturnValue(query);

    const result = await addRoleIdOnly({
      name: "Supervisor",
      permissions: ["read:room", "update:room"],
      hierarchyLevel: 2,
    });

    expect(result.data).toBe("role-1");
    expect(supabaseMock.from).toHaveBeenCalledWith("roles");
    expect(query.insert).toHaveBeenCalledWith([
      {
        name: "Supervisor",
        permissions: ["read:room", "update:room"],
        hierarchy_level: 2,
      },
    ]);
    expect(query.select).toHaveBeenCalledWith("id");
    expect(query.select).not.toHaveBeenCalledWith(ROLE_SELECT_COLUMNS);
    expect(query.single).toHaveBeenCalledTimes(1);
  });

  it("amenity update commands can avoid returned rows when the caller can merge locally", async () => {
    const query = createQuery({ data: null, error: null });
    supabaseMock.from.mockReturnValue(query);

    await updateAmenityWithoutReturning("amenity-1", {
      name: "Wi-Fi",
      icon: "Wifi",
    });

    expect(supabaseMock.from).toHaveBeenCalledWith("amenities");
    expect(query.update).toHaveBeenCalledWith({
      name: "Wi-Fi",
      icon: "Wifi",
    });
    expect(query.eq).toHaveBeenCalledWith("id", "amenity-1");
    expect(query.select).not.toHaveBeenCalled();
    expect(query.single).not.toHaveBeenCalled();
  });

  it("amenity create commands return only the inserted id needed for local state", async () => {
    if (typeof addAmenityIdOnly !== "function") {
      expect(addAmenityIdOnly).toBeTypeOf("function");
      return;
    }

    const query = createQuery({ data: { id: "amenity-1" }, error: null });
    supabaseMock.from.mockReturnValue(query);

    const result = await addAmenityIdOnly({
      name: "Free Wi-Fi",
      icon: "Wifi",
    });

    expect(result.data).toBe("amenity-1");
    expect(supabaseMock.from).toHaveBeenCalledWith("amenities");
    expect(query.insert).toHaveBeenCalledWith([
      {
        name: "Free Wi-Fi",
        icon: "Wifi",
      },
    ]);
    expect(query.select).toHaveBeenCalledWith("id");
    expect(query.select).not.toHaveBeenCalledWith(AMENITY_SELECT_COLUMNS);
    expect(query.single).toHaveBeenCalledTimes(1);
  });

  it("sticky note update commands can avoid returned rows when the caller can merge locally", async () => {
    const query = createQuery({ data: null, error: null });
    supabaseMock.from.mockReturnValue(query);

    await updateStickyNoteWithoutReturning("note-1", {
      title: "Front desk",
      description: "Call guest at 9",
      color: "blue",
    });

    expect(supabaseMock.from).toHaveBeenCalledWith("sticky_notes");
    expect(query.update).toHaveBeenCalledWith({
      title: "Front desk",
      description: "Call guest at 9",
      color: "blue",
    });
    expect(query.eq).toHaveBeenCalledWith("id", "note-1");
    expect(query.select).not.toHaveBeenCalled();
    expect(query.single).not.toHaveBeenCalled();
  });

  it("sticky note create commands return only the inserted id needed for local state", async () => {
    if (typeof addStickyNoteIdOnly !== "function") {
      expect(addStickyNoteIdOnly).toBeTypeOf("function");
      return;
    }

    const query = createQuery({ data: { id: "note-1" }, error: null });
    supabaseMock.from.mockReturnValue(query);

    const result = await addStickyNoteIdOnly({
      title: "Front desk",
      description: "Call guest at 9",
      color: "blue",
      user_id: "user-1",
    });

    expect(result.data).toBe("note-1");
    expect(supabaseMock.from).toHaveBeenCalledWith("sticky_notes");
    expect(query.insert).toHaveBeenCalledWith([
      {
        title: "Front desk",
        description: "Call guest at 9",
        color: "blue",
        user_id: "user-1",
      },
    ]);
    expect(query.select).toHaveBeenCalledWith("id");
    expect(query.select).not.toHaveBeenCalledWith(STICKY_NOTE_SELECT_COLUMNS);
    expect(query.single).toHaveBeenCalledTimes(1);
  });

  it("property closure update commands can avoid returned rows while preserving column mapping", async () => {
    const query = createQuery({ data: null, error: null });
    supabaseMock.from.mockReturnValue(query);

    await updatePropertyClosureWithoutReturning("closure-1", {
      propertyId: "property-1",
      roomTypeId: undefined,
      startDate: "2026-06-01",
      endDate: "2026-06-03",
      reason: undefined,
    });

    expect(supabaseMock.from).toHaveBeenCalledWith("property_closures");
    expect(query.update).toHaveBeenCalledWith({
      property_id: "property-1",
      room_type_id: null,
      start_date: "2026-06-01",
      end_date: "2026-06-03",
      reason: null,
    });
    expect(query.eq).toHaveBeenCalledWith("id", "closure-1");
    expect(query.select).not.toHaveBeenCalled();
    expect(query.single).not.toHaveBeenCalled();
  });

  it("property closure create commands return only the inserted id needed for local state", async () => {
    if (typeof addPropertyClosureIdOnly !== "function") {
      expect(addPropertyClosureIdOnly).toBeTypeOf("function");
      return;
    }

    const query = createQuery({ data: { id: "closure-1" }, error: null });
    supabaseMock.from.mockReturnValue(query);

    const result = await addPropertyClosureIdOnly({
      propertyId: "property-1",
      roomTypeId: undefined,
      startDate: "2026-06-01",
      endDate: "2026-06-03",
      reason: undefined,
    });

    expect(result.data).toBe("closure-1");
    expect(supabaseMock.from).toHaveBeenCalledWith("property_closures");
    expect(query.insert).toHaveBeenCalledWith([
      {
        property_id: "property-1",
        room_type_id: null,
        start_date: "2026-06-01",
        end_date: "2026-06-03",
        reason: null,
      },
    ]);
    expect(query.select).toHaveBeenCalledWith("id");
    expect(query.select).not.toHaveBeenCalledWith(PROPERTY_CLOSURE_SELECT_COLUMNS);
    expect(query.single).toHaveBeenCalledTimes(1);
  });

  it("seasonal price update commands can avoid returned rows while preserving column mapping", async () => {
    const query = createQuery({ data: null, error: null });
    supabaseMock.from.mockReturnValue(query);

    await updateSeasonalPriceWithoutReturning("seasonal-1", {
      roomTypeId: "room-type-1",
      name: "Summer",
      price: 1500,
      startDate: "2026-06-01",
      endDate: "2026-06-30",
    });

    expect(supabaseMock.from).toHaveBeenCalledWith("seasonal_prices");
    expect(query.update).toHaveBeenCalledWith({
      room_type_id: "room-type-1",
      name: "Summer",
      price: 1500,
      start_date: "2026-06-01",
      end_date: "2026-06-30",
    });
    expect(query.eq).toHaveBeenCalledWith("id", "seasonal-1");
    expect(query.select).not.toHaveBeenCalled();
    expect(query.single).not.toHaveBeenCalled();
  });

  it("seasonal price create commands return only the inserted id needed for local state", async () => {
    if (typeof addSeasonalPriceIdOnly !== "function") {
      expect(addSeasonalPriceIdOnly).toBeTypeOf("function");
      return;
    }

    const query = createQuery({ data: { id: "seasonal-1" }, error: null });
    supabaseMock.from.mockReturnValue(query);

    const result = await addSeasonalPriceIdOnly({
      roomTypeId: "room-type-1",
      name: "Summer",
      price: 1500,
      startDate: "2026-06-01",
      endDate: "2026-06-30",
    });

    expect(result.data).toBe("seasonal-1");
    expect(supabaseMock.from).toHaveBeenCalledWith("seasonal_prices");
    expect(query.insert).toHaveBeenCalledWith([
      {
        room_type_id: "room-type-1",
        name: "Summer",
        price: 1500,
        start_date: "2026-06-01",
        end_date: "2026-06-30",
      },
    ]);
    expect(query.select).toHaveBeenCalledWith("id");
    expect(query.select).not.toHaveBeenCalledWith(SEASONAL_PRICE_SELECT_COLUMNS);
    expect(query.single).toHaveBeenCalledTimes(1);
  });

  it("uploadFile posts image data without caching the command response", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ url: "https://cdn.test/banner.jpg" }), {
        status: 200,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const url = await uploadFile(new File(["image"], "banner.jpg", { type: "image/jpeg" }));

    expect(url).toBe("https://cdn.test/banner.jpg");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/uploads",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        cache: "no-store",
      }),
    );
    const [, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(init.body).toBeInstanceOf(FormData);

  });
});

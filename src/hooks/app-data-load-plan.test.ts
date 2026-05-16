import { describe, expect, it } from "vitest";

import {
  getAppDataLoadPlan,
  type AppDataDataset,
} from "./app-data-load-plan";

const expectDatasets = (actual: readonly AppDataDataset[], expected: AppDataDataset[]) => {
  expect([...actual].sort()).toEqual([...expected].sort());
};

describe("getAppDataLoadPlan", () => {
  it("skips global data on admin auth pages", () => {
    expect(getAppDataLoadPlan({ pathname: "/admin/login", userId: null })).toMatchObject({
      mode: "none",
      datasets: [],
    });
    expect(getAppDataLoadPlan({ pathname: "/admin/forget-password", userId: "user-1" })).toMatchObject({
      mode: "none",
      datasets: [],
    });
  });

  it("does not load public fallback data while protected admin routes wait for auth", () => {
    expect(getAppDataLoadPlan({ pathname: "/admin/dashboard", userId: null })).toMatchObject({
      mode: "none",
      datasets: [],
    });
  });

  it("falls back to chrome data for unclassified authenticated admin routes", () => {
    const plan = getAppDataLoadPlan({ pathname: "/admin/unknown", userId: "user-1" });

    expect(plan.mode).toBe("admin");
    expectDatasets(plan.datasets, ["property"]);
    expect(plan.datasets).not.toContain("guests");
    expect(plan.datasets).not.toContain("roles");
    expect(plan.datasets).not.toContain("users");
    expect(plan.datasets).not.toContain("housekeepingAssignments");
    expect(plan.datasets).not.toContain("dashboardReservations");
  });

  it("loads a narrower admin settings dataset without reservation-heavy calls", () => {
    const plan = getAppDataLoadPlan({ pathname: "/admin/settings", userId: "user-1" });

    expect(plan.mode).toBe("admin");
    expectDatasets(plan.datasets, ["property"]);
    expect(plan.datasets).not.toContain("rooms");
    expect(plan.datasets).not.toContain("amenities");
    expect(plan.datasets).not.toContain("roles");
    expect(plan.datasets).not.toContain("users");
    expect(plan.datasets).not.toContain("roomTypes");
    expect(plan.datasets).not.toContain("propertyClosures");
    expect(plan.datasets).not.toContain("guests");
    expect(plan.datasets).not.toContain("stickyNotes");
    expect(plan.datasets).not.toContain("housekeepingAssignments");
    expect(plan.datasets).not.toContain("dashboardReservations");
  });

  it.each([
    "/admin/posts",
    "/admin/posts/create",
    "/admin/posts/post-1",
    "/admin/posts/categories",
    "/admin/events",
    "/admin/events/create",
    "/admin/events/event-1",
    "/admin/reviews",
    "/admin/reviews/create",
    "/admin/reviews/review-1",
    "/admin/feedback",
    "/admin/donations",
    "/admin/manual-receipt",
    "/admin/manual-receipt/new",
    "/admin/activity",
  ])("uses only chrome data for self-fetching admin route %s", (pathname) => {
    const plan = getAppDataLoadPlan({ pathname, userId: "user-1" });

    expect(plan.mode).toBe("admin");
    expectDatasets(plan.datasets, ["property"]);
  });

  it("lets admin rooms hydrate through its route-backed room API", () => {
    const plan = getAppDataLoadPlan({ pathname: "/admin/rooms", userId: "user-1" });

    expect(plan.mode).toBe("admin");
    expectDatasets(plan.datasets, ["property"]);
    expect(plan.datasets).not.toContain("rooms");
    expect(plan.datasets).not.toContain("roomTypes");
    expect(plan.datasets).not.toContain("guests");
    expect(plan.datasets).not.toContain("dashboardReservations");
  });

  it("lets admin room types hydrate through its route-backed room type API", () => {
    const plan = getAppDataLoadPlan({ pathname: "/admin/room-types", userId: "user-1" });

    expect(plan.mode).toBe("admin");
    expectDatasets(plan.datasets, ["property"]);
    expect(plan.datasets).not.toContain("roomTypes");
    expect(plan.datasets).not.toContain("roomTypeAmenities");
    expect(plan.datasets).not.toContain("amenities");
    expect(plan.datasets).not.toContain("rooms");
    expect(plan.datasets).not.toContain("guests");
    expect(plan.datasets).not.toContain("dashboardReservations");
  });

  it("lets admin rates hydrate through its route-backed rates API", () => {
    const plan = getAppDataLoadPlan({ pathname: "/admin/rates", userId: "user-1" });

    expect(plan.mode).toBe("admin");
    expectDatasets(plan.datasets, ["property"]);
    expect(plan.datasets).not.toContain("ratePlans");
    expect(plan.datasets).not.toContain("seasonalPrices");
    expect(plan.datasets).not.toContain("roomTypes");
    expect(plan.datasets).not.toContain("guests");
    expect(plan.datasets).not.toContain("rooms");
    expect(plan.datasets).not.toContain("dashboardReservations");
  });

  it("loads only category data for admin room categories", () => {
    const plan = getAppDataLoadPlan({ pathname: "/admin/room-categories", userId: "user-1" });

    expect(plan.mode).toBe("admin");
    expectDatasets(plan.datasets, ["property"]);
    expect(plan.datasets).not.toContain("roomCategories");
    expect(plan.datasets).not.toContain("roomTypes");
    expect(plan.datasets).not.toContain("dashboardReservations");
  });

  it("lets the admin guests index use its paginated API without a startup guests fetch", () => {
    const plan = getAppDataLoadPlan({ pathname: "/admin/guests", userId: "user-1" });

    expect(plan.mode).toBe("admin");
    expectDatasets(plan.datasets, ["property"]);
    expect(plan.datasets).not.toContain("guests");
    expect(plan.datasets).not.toContain("rooms");
    expect(plan.datasets).not.toContain("dashboardReservations");
  });

  it("loads guest reservation history data for admin guest details", () => {
    const plan = getAppDataLoadPlan({ pathname: "/admin/guests/guest-1", userId: "user-1" });

    expect(plan.mode).toBe("admin");
    expectDatasets(plan.datasets, ["property"]);
    expect(plan.datasets).not.toContain("guests");
    expect(plan.datasets).not.toContain("rooms");
    expect(plan.datasets).not.toContain("stickyNotes");
    expect(plan.datasets).not.toContain("housekeepingAssignments");
    expect(plan.datasets).not.toContain("dashboardReservations");
  });

  it("lets admin housekeeping hydrate through its route-backed housekeeping API", () => {
    const plan = getAppDataLoadPlan({ pathname: "/admin/housekeeping", userId: "user-1" });

    expect(plan.mode).toBe("admin");
    expectDatasets(plan.datasets, ["property"]);
    expect(plan.datasets).not.toContain("rooms");
    expect(plan.datasets).not.toContain("roomTypes");
    expect(plan.datasets).not.toContain("housekeepers");
    expect(plan.datasets).not.toContain("housekeepingAssignments");
    expect(plan.datasets).not.toContain("guests");
    expect(plan.datasets).not.toContain("roles");
    expect(plan.datasets).not.toContain("users");
    expect(plan.datasets).not.toContain("dashboardReservations");
    expect(plan.datasets).not.toContain("stickyNotes");
  });

  it("loads dashboard widgets without unrelated admin configuration data", () => {
    const plan = getAppDataLoadPlan({ pathname: "/admin/dashboard", userId: "user-1" });

    expect(plan.mode).toBe("admin");
    expectDatasets(plan.datasets, ["property", "stickyNotes"]);
    expect(plan.datasets).not.toContain("guests");
    expect(plan.datasets).not.toContain("rooms");
    expect(plan.datasets).not.toContain("roomTypes");
    expect(plan.datasets).not.toContain("roomCategories");
    expect(plan.datasets).not.toContain("ratePlans");
    expect(plan.datasets).not.toContain("housekeepingAssignments");
    expect(plan.datasets).not.toContain("dashboardReservations");
  });

  it("loads calendar hover data without unrelated admin configuration data", () => {
    const plan = getAppDataLoadPlan({ pathname: "/admin/calendar", userId: "user-1" });

    expect(plan.mode).toBe("admin");
    expectDatasets(plan.datasets, ["property"]);
    expect(plan.datasets).not.toContain("guests");
    expect(plan.datasets).not.toContain("rooms");
    expect(plan.datasets).not.toContain("ratePlans");
    expect(plan.datasets).not.toContain("roomTypes");
    expect(plan.datasets).not.toContain("stickyNotes");
    expect(plan.datasets).not.toContain("housekeepingAssignments");
    expect(plan.datasets).not.toContain("dashboardReservations");
  });

  it("loads report shell data without reservation-heavy startup calls", () => {
    const plan = getAppDataLoadPlan({ pathname: "/admin/reports", userId: "user-1" });

    expect(plan.mode).toBe("admin");
    expectDatasets(plan.datasets, ["property"]);
    expect(plan.datasets).not.toContain("guests");
    expect(plan.datasets).not.toContain("rooms");
    expect(plan.datasets).not.toContain("stickyNotes");
    expect(plan.datasets).not.toContain("housekeepingAssignments");
    expect(plan.datasets).not.toContain("dashboardReservations");
  });

  it("lets the admin reservations index use its paginated API without a startup reservations fetch", () => {
    const plan = getAppDataLoadPlan({ pathname: "/admin/reservations", userId: "user-1" });

    expect(plan.mode).toBe("admin");
    expectDatasets(plan.datasets, ["property"]);
    expect(plan.datasets).not.toContain("guests");
    expect(plan.datasets).not.toContain("rooms");
    expect(plan.datasets).not.toContain("roomTypes");
    expect(plan.datasets).not.toContain("ratePlans");
    expect(plan.datasets).not.toContain("seasonalPrices");
    expect(plan.datasets).not.toContain("dashboardReservations");
  });

  it("lets the reservation creation form load reference data through its route API", () => {
    const plan = getAppDataLoadPlan({ pathname: "/admin/reservations/new", userId: "user-1" });

    expect(plan.mode).toBe("admin");
    expectDatasets(plan.datasets, ["property"]);
    expect(plan.datasets).not.toContain("guests");
    expect(plan.datasets).not.toContain("rooms");
    expect(plan.datasets).not.toContain("roomTypes");
    expect(plan.datasets).not.toContain("ratePlans");
    expect(plan.datasets).not.toContain("seasonalPrices");
    expect(plan.datasets).not.toContain("dashboardReservations");
    expect(plan.datasets).not.toContain("roomCategories");
    expect(plan.datasets).not.toContain("propertyClosures");
    expect(plan.datasets).not.toContain("stickyNotes");
    expect(plan.datasets).not.toContain("housekeepingAssignments");
  });

  it("loads reservation detail display data without edit-only seasonal prices", () => {
    const plan = getAppDataLoadPlan({
      pathname: "/admin/reservations/reservation-1",
      userId: "user-1",
    });

    expect(plan.mode).toBe("admin");
    expectDatasets(plan.datasets, ["property"]);
    expect(plan.datasets).not.toContain("guests");
    expect(plan.datasets).not.toContain("rooms");
    expect(plan.datasets).not.toContain("roomTypes");
    expect(plan.datasets).not.toContain("ratePlans");
    expect(plan.datasets).not.toContain("seasonalPrices");
    expect(plan.datasets).not.toContain("dashboardReservations");
    expect(plan.datasets).not.toContain("stickyNotes");
    expect(plan.datasets).not.toContain("housekeepingAssignments");
  });

  it("lets reservation edits load reference data through the form route API", () => {
    const plan = getAppDataLoadPlan({
      pathname: "/admin/reservations/reservation-1/edit",
      userId: "user-1",
    });

    expect(plan.mode).toBe("admin");
    expectDatasets(plan.datasets, ["property"]);
    expect(plan.datasets).not.toContain("guests");
    expect(plan.datasets).not.toContain("rooms");
    expect(plan.datasets).not.toContain("roomTypes");
    expect(plan.datasets).not.toContain("ratePlans");
    expect(plan.datasets).not.toContain("seasonalPrices");
    expect(plan.datasets).not.toContain("dashboardReservations");
    expect(plan.datasets).not.toContain("stickyNotes");
    expect(plan.datasets).not.toContain("housekeepingAssignments");
  });

  it("skips global data for public static pages that do not consume context data", () => {
    const plan = getAppDataLoadPlan({ pathname: "/about-us", userId: "user-1" });

    expect(plan.mode).toBe("none");
    expectDatasets(plan.datasets, []);
  });

  it("keeps a property-only plan for public shop currency formatting", () => {
    const plan = getAppDataLoadPlan({ pathname: "/shop", userId: null });

    expect(plan.mode).toBe("public-basic");
    expectDatasets(plan.datasets, ["property"]);
  });

  it("uses a route-backed room preview API for the public home page", () => {
    const plan = getAppDataLoadPlan({ pathname: "/", userId: null });

    expect(plan.mode).toBe("public-room-preview");
    expectDatasets(plan.datasets, ["property"]);
    expect(plan.datasets).not.toContain("rooms");
    expect(plan.datasets).not.toContain("roomTypes");
    expect(plan.datasets).not.toContain("roomTypeAmenities");
    expect(plan.datasets).not.toContain("amenities");
    expect(plan.datasets).not.toContain("ratePlans");
    expect(plan.datasets).not.toContain("seasonalPrices");
    expect(plan.datasets).not.toContain("propertyClosures");
  });

  it("uses route-backed search data for the public booking search page", () => {
    const plan = getAppDataLoadPlan({ pathname: "/book", userId: null });

    expect(plan.mode).toBe("public-booking");
    expectDatasets(plan.datasets, ["property"]);
    expect(plan.datasets).not.toContain("rooms");
    expect(plan.datasets).not.toContain("roomTypes");
    expect(plan.datasets).not.toContain("roomTypeAmenities");
    expect(plan.datasets).not.toContain("ratePlans");
    expect(plan.datasets).not.toContain("seasonalPrices");
    expect(plan.datasets).not.toContain("propertyClosures");
    expect(plan.datasets).not.toContain("amenities");
    expect(plan.datasets).not.toContain("guests");
    expect(plan.datasets).not.toContain("dashboardReservations");
  });

  it("uses route-backed room detail data for public room routes", () => {
    const plan = getAppDataLoadPlan({ pathname: "/book/rooms/room-type-1", userId: null });

    expect(plan.mode).toBe("public-booking");
    expectDatasets(plan.datasets, ["property"]);
    expect(plan.datasets).not.toContain("rooms");
    expect(plan.datasets).not.toContain("roomTypes");
    expect(plan.datasets).not.toContain("roomTypeAmenities");
    expect(plan.datasets).not.toContain("ratePlans");
    expect(plan.datasets).not.toContain("seasonalPrices");
    expect(plan.datasets).not.toContain("propertyClosures");
    expect(plan.datasets).not.toContain("amenities");
    expect(plan.datasets).not.toContain("guests");
    expect(plan.datasets).not.toContain("users");
    expect(plan.datasets).not.toContain("dashboardReservations");
  });

  it("uses route-backed selected-room data on the public review route", () => {
    const plan = getAppDataLoadPlan({ pathname: "/book/review", userId: null });

    expect(plan.mode).toBe("public-booking");
    expectDatasets(plan.datasets, ["property"]);
    expect(plan.datasets).not.toContain("rooms");
    expect(plan.datasets).not.toContain("roomTypes");
    expect(plan.datasets).not.toContain("ratePlans");
    expect(plan.datasets).not.toContain("seasonalPrices");
    expect(plan.datasets).not.toContain("propertyClosures");
    expect(plan.datasets).not.toContain("amenities");
    expect(plan.datasets).not.toContain("guests");
    expect(plan.datasets).not.toContain("dashboardReservations");
  });

  it("uses route-backed confirmation data without loading all rooms", () => {
    const plan = getAppDataLoadPlan({ pathname: "/book/confirmation/res-1", userId: null });

    expect(plan.mode).toBe("public-booking");
    expectDatasets(plan.datasets, ["property"]);
    expect(plan.datasets).not.toContain("rooms");
    expect(plan.datasets).not.toContain("roomTypes");
    expect(plan.datasets).not.toContain("ratePlans");
    expect(plan.datasets).not.toContain("seasonalPrices");
    expect(plan.datasets).not.toContain("propertyClosures");
    expect(plan.datasets).not.toContain("amenities");
    expect(plan.datasets).not.toContain("dashboardReservations");
  });
});

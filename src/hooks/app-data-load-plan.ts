export type AppDataDataset =
  | "property"
  | "guests"
  | "rooms"
  | "roomTypes"
  | "roomCategories"
  | "ratePlans"
  | "seasonalPrices"
  | "propertyClosures"
  | "roles"
  | "amenities"
  | "stickyNotes"
  | "users"
  | "housekeepers"
  | "housekeepingAssignments"
  | "roomTypeAmenities"
  | "dashboardReservations";

export type AppDataLoadMode =
  | "none"
  | "public-basic"
  | "public-room-preview"
  | "public-booking"
  | "admin";

export type AppDataLoadPlan = {
  mode: AppDataLoadMode;
  datasets: readonly AppDataDataset[];
};

const NONE_PLAN: AppDataLoadPlan = {
  mode: "none",
  datasets: [],
};

const PUBLIC_BASIC_PLAN: AppDataLoadPlan = {
  mode: "public-basic",
  datasets: ["property"],
};

const PUBLIC_ROOM_PREVIEW_PLAN: AppDataLoadPlan = {
  mode: "public-room-preview",
  datasets: ["property"],
};

const PUBLIC_BOOKING_SEARCH_PLAN: AppDataLoadPlan = {
  mode: "public-booking",
  datasets: ["property"],
};

const PUBLIC_BOOKING_ROOM_PLAN: AppDataLoadPlan = {
  mode: "public-booking",
  datasets: ["property"],
};

const PUBLIC_BOOKING_REVIEW_PLAN: AppDataLoadPlan = {
  mode: "public-booking",
  datasets: ["property"],
};

const PUBLIC_BOOKING_CONFIRMATION_PLAN: AppDataLoadPlan = {
  mode: "public-booking",
  datasets: ["property"],
};

const ADMIN_PLAN: AppDataLoadPlan = {
  mode: "admin",
  datasets: ["property"],
};

const ADMIN_SETTINGS_PLAN: AppDataLoadPlan = {
  mode: "admin",
  datasets: ["property"],
};

const ADMIN_CHROME_PLAN: AppDataLoadPlan = {
  mode: "admin",
  datasets: ["property"],
};

const ADMIN_DASHBOARD_PLAN: AppDataLoadPlan = {
  mode: "admin",
  datasets: ["property", "stickyNotes"],
};

const ADMIN_RESERVATIONS_PLAN: AppDataLoadPlan = {
  mode: "admin",
  datasets: ["property"],
};

const ADMIN_RESERVATIONS_INDEX_PLAN: AppDataLoadPlan = {
  mode: "admin",
  datasets: ["property"],
};

const ADMIN_RESERVATION_DETAIL_PLAN: AppDataLoadPlan = {
  mode: "admin",
  datasets: ["property"],
};

const ADMIN_RESERVATION_EDIT_PLAN: AppDataLoadPlan = {
  mode: "admin",
  datasets: ["property"],
};

const ADMIN_CALENDAR_PLAN: AppDataLoadPlan = {
  mode: "admin",
  datasets: ["property"],
};

const ADMIN_REPORTS_PLAN: AppDataLoadPlan = {
  mode: "admin",
  datasets: ["property"],
};

const ADMIN_GUESTS_PLAN: AppDataLoadPlan = {
  mode: "admin",
  datasets: ["property"],
};

const ADMIN_GUEST_DETAILS_PLAN: AppDataLoadPlan = {
  mode: "admin",
  datasets: ["property"],
};

const ADMIN_HOUSEKEEPING_PLAN: AppDataLoadPlan = {
  mode: "admin",
  datasets: ["property"],
};

const ADMIN_ROOM_CATEGORIES_PLAN: AppDataLoadPlan = {
  mode: "admin",
  datasets: ["property"],
};

const ADMIN_ROOM_TYPES_PLAN: AppDataLoadPlan = {
  mode: "admin",
  datasets: ["property"],
};

const ADMIN_ROOMS_PLAN: AppDataLoadPlan = {
  mode: "admin",
  datasets: ["property"],
};

const ADMIN_RATES_PLAN: AppDataLoadPlan = {
  mode: "admin",
  datasets: ["property"],
};

const ADMIN_AUTH_PATHS = new Set(["/admin/login", "/admin/forget-password"]);

const ADMIN_CHROME_ONLY_PATHS = [
  "/admin/posts",
  "/admin/events",
  "/admin/reviews",
  "/admin/testimonials",
  "/admin/feedback",
  "/admin/donations",
  "/admin/manual-receipt",
  "/admin/activity",
] as const;

const normalizePathname = (pathname: string | null | undefined) => {
  if (!pathname) return "/";
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }
  return pathname;
};

const isPathOrChild = (path: string, basePath: string) =>
  path === basePath || path.startsWith(`${basePath}/`);

export const isAppDataDatasetEnabled = (
  plan: AppDataLoadPlan,
  dataset: AppDataDataset
) => plan.datasets.includes(dataset);

export function getAppDataLoadPlan({
  pathname,
  userId,
}: {
  pathname: string | null | undefined;
  userId: string | null;
}): AppDataLoadPlan {
  const path = normalizePathname(pathname);

  if (ADMIN_AUTH_PATHS.has(path)) {
    return NONE_PLAN;
  }

  if (path === "/admin" || path.startsWith("/admin/")) {
    if (!userId) {
      return NONE_PLAN;
    }

    if (path === "/admin/settings" || path.startsWith("/admin/settings/")) {
      return ADMIN_SETTINGS_PLAN;
    }

    if (path === "/admin" || path === "/admin/dashboard") {
      return ADMIN_DASHBOARD_PLAN;
    }

    if (path === "/admin/reservations") {
      return ADMIN_RESERVATIONS_INDEX_PLAN;
    }

    if (path === "/admin/reservations/new") {
      return ADMIN_RESERVATIONS_PLAN;
    }

    if (isPathOrChild(path, "/admin/reservations")) {
      return path.endsWith("/edit")
        ? ADMIN_RESERVATION_EDIT_PLAN
        : ADMIN_RESERVATION_DETAIL_PLAN;
    }

    if (path === "/admin/calendar") {
      return ADMIN_CALENDAR_PLAN;
    }

    if (path === "/admin/reports") {
      return ADMIN_REPORTS_PLAN;
    }

    if (path === "/admin/guests") {
      return ADMIN_GUESTS_PLAN;
    }

    if (isPathOrChild(path, "/admin/guests")) {
      return ADMIN_GUEST_DETAILS_PLAN;
    }

    if (path === "/admin/housekeeping") {
      return ADMIN_HOUSEKEEPING_PLAN;
    }

    if (path === "/admin/room-categories") {
      return ADMIN_ROOM_CATEGORIES_PLAN;
    }

    if (path === "/admin/room-types") {
      return ADMIN_ROOM_TYPES_PLAN;
    }

    if (path === "/admin/rooms") {
      return ADMIN_ROOMS_PLAN;
    }

    if (path === "/admin/rates") {
      return ADMIN_RATES_PLAN;
    }

    if (ADMIN_CHROME_ONLY_PATHS.some((basePath) => isPathOrChild(path, basePath))) {
      return ADMIN_CHROME_PLAN;
    }

    return ADMIN_PLAN;
  }

  if (path === "/") {
    return PUBLIC_ROOM_PREVIEW_PLAN;
  }

  if (path === "/book/review") {
    return PUBLIC_BOOKING_REVIEW_PLAN;
  }

  if (isPathOrChild(path, "/book/confirmation")) {
    return PUBLIC_BOOKING_CONFIRMATION_PLAN;
  }

  if (path === "/book") {
    return PUBLIC_BOOKING_SEARCH_PLAN;
  }

  if (path.startsWith("/book/")) {
    return PUBLIC_BOOKING_ROOM_PLAN;
  }

  if (path === "/shop") {
    return PUBLIC_BASIC_PLAN;
  }

  return NONE_PLAN;
}

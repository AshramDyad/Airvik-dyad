import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({
  unstable_cache: (fn: unknown) => fn,
}));

const createServerSupabaseClientMock = vi.hoisted(() => vi.fn());

vi.mock("@/integrations/supabase/server", () => ({
  createServerSupabaseClient: createServerSupabaseClientMock,
}));

import {
  BOOKINGS_SUMMARY_SELECT_COLUMNS,
  getCachedReservationsPage,
} from "./cache";

const summaryRow = {
  booking_id: "BK-1",
  booking_date: "2026-05-01T00:00:00.000Z",
  guest_id: "guest-1",
  guest_first_name: "Asha",
  guest_last_name: "Guest",
  guest_name: "Asha Guest",
  guest_email: "asha@example.com",
  guest_phone: "555",
  total_amount: 1000,
  room_count: 1,
  check_in_date: "2026-05-13",
  check_out_date: "2026-05-14",
  number_of_guests: 2,
  adult_count: 2,
  child_count: 0,
  status: "Confirmed",
  reservation_rows: [],
};

const createQuery = (response: unknown) => {
  const query = {
    select: vi.fn(() => query),
    or: vi.fn(() => query),
    order: vi.fn(() => query),
    range: vi.fn(async () => response),
  };
  return query;
};

describe("reservation cache data access", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("selects exact bookings summary columns for cached pages", async () => {
    const query = createQuery({ data: [summaryRow], error: null, count: 1 });
    const supabase = { from: vi.fn(() => query) };
    createServerSupabaseClientMock.mockReturnValue(supabase);

    await getCachedReservationsPage({ limit: 25, offset: 10, query: "asha" });

    expect(supabase.from).toHaveBeenCalledWith("bookings_summary_view");
    expect(query.select).toHaveBeenCalledWith(BOOKINGS_SUMMARY_SELECT_COLUMNS, {
      count: "exact",
    });
    expect(query.or).toHaveBeenCalledWith(
      "booking_id.ilike.%asha%,guest_name.ilike.%asha%,guest_email.ilike.%asha%"
    );
    expect(query.range).toHaveBeenCalledWith(10, 34);
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  requireFeature: vi.fn(),
  HttpError: class HttpError extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.status = status;
    }
  },
}));
const createServerSupabaseClientMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/server/auth", () => authMocks);
vi.mock("@/integrations/supabase/server", () => ({
  createServerSupabaseClient: createServerSupabaseClientMock,
}));

import { BOOKINGS_SUMMARY_SELECT_COLUMNS } from "@/server/reservations/cache";
import { GET } from "./route";

const createQuery = (response: unknown) => {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    order: vi.fn(() => query),
    range: vi.fn(async () => response),
  };
  return query;
};

describe("bookings report export API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses exact bookings summary columns for arrivals and dispatches", async () => {
    const query = createQuery({ data: [], error: null });
    const supabase = { from: vi.fn(() => query) };
    createServerSupabaseClientMock.mockReturnValue(supabase);

    const response = await GET(
      new Request(
        "http://localhost/api/admin/reports/bookings/export?arrival=2026-05-13&dispatch=2026-05-14"
      ) as never
    );

    expect(response.status).toBe(200);
    expect(supabase.from).toHaveBeenCalledWith("bookings_summary_view");
    expect(query.select).toHaveBeenCalledWith(BOOKINGS_SUMMARY_SELECT_COLUMNS);
    expect(query.eq).toHaveBeenCalledWith("check_in_date", "2026-05-13");
    expect(query.eq).toHaveBeenCalledWith("check_out_date", "2026-05-14");
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const supabaseMocks = vi.hoisted(() => ({
  createServerSupabaseClient: vi.fn(),
}));

vi.mock("@/integrations/supabase/server", () => supabaseMocks);

import {
  getGuestsPage,
  GUEST_PAGE_SELECT_COLUMNS,
} from "./guests";

const createGuestsQuery = (response: unknown) => {
  const query = {
    from: vi.fn(() => query),
    select: vi.fn(() => query),
    or: vi.fn(() => query),
    order: vi.fn(() => query),
    range: vi.fn(async () => response),
  };
  return query;
};

describe("guest page server data access", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("selects only guest index columns for a bounded page", async () => {
    const query = createGuestsQuery({
      data: [
        {
          id: "guest-1",
          first_name: "Asha",
          last_name: "Guest",
          email: "asha@example.com",
          phone: "9999999999",
          address: "Road 1",
          pincode: "249201",
          city: "Rishikesh",
          state: "Uttarakhand",
          country: "India",
          created_at: "2026-05-13T00:00:00.000Z",
        },
      ],
      error: null,
      count: 26,
    });
    supabaseMocks.createServerSupabaseClient.mockReturnValue(query);

    await expect(
      getGuestsPage({ limit: 25, offset: 25, query: "asha" }),
    ).resolves.toEqual({
      data: [
        {
          id: "guest-1",
          firstName: "Asha",
          lastName: "Guest",
          email: "asha@example.com",
          phone: "9999999999",
          address: "Road 1",
          pincode: "249201",
          city: "Rishikesh",
          state: "Uttarakhand",
          country: "India",
        },
      ],
      nextOffset: null,
      count: 26,
    });

    expect(query.from).toHaveBeenCalledWith("guests");
    expect(query.select).toHaveBeenCalledWith(GUEST_PAGE_SELECT_COLUMNS, {
      count: "exact",
    });
    expect(query.or).toHaveBeenCalledWith(
      "first_name.ilike.%asha%,last_name.ilike.%asha%,email.ilike.%asha%,phone.ilike.%asha%",
    );
    expect(query.order).toHaveBeenCalledWith("created_at", {
      ascending: false,
      nullsFirst: false,
    });
    expect(query.range).toHaveBeenCalledWith(25, 49);
  });

  it("clamps excessive page sizes", async () => {
    const query = createGuestsQuery({ data: [], error: null, count: 0 });
    supabaseMocks.createServerSupabaseClient.mockReturnValue(query);

    await getGuestsPage({ limit: 1000, offset: -10 });

    expect(query.range).toHaveBeenCalledWith(0, 99);
    expect(query.or).not.toHaveBeenCalled();
  });
});

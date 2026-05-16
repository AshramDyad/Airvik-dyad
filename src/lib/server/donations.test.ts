import { beforeEach, describe, expect, it, vi } from "vitest";

const getServerSupabaseClientMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/server/supabase", () => ({
  getServerSupabaseClient: getServerSupabaseClientMock,
}));

import {
  DONATION_SELECT_COLUMNS,
  DONATION_STATS_SELECT_COLUMNS,
} from "@/lib/api/donations";
import { getAdminDonations, getAdminDonationStats } from "./donations";

const createQuery = (response: unknown) => {
  const query = {
    select: vi.fn(() => query),
    order: vi.fn(() => query),
    eq: vi.fn(() => query),
    gte: vi.fn(() => query),
    lte: vi.fn(() => query),
    or: vi.fn(() => query),
    maybeSingle: vi.fn(async () => response),
    then: (resolve: (value: unknown) => unknown) => Promise.resolve(response).then(resolve),
  };
  return query;
};

describe("admin donation server data access", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("getAdminDonations selects exact donation columns", async () => {
    const query = createQuery({ data: [], error: null });
    const supabase = { from: vi.fn(() => query) };
    getServerSupabaseClientMock.mockResolvedValue(supabase);

    await getAdminDonations({ status: "paid", query: "asha" });

    expect(supabase.from).toHaveBeenCalledWith("donations");
    expect(query.select).toHaveBeenCalledWith(DONATION_SELECT_COLUMNS);
    expect(query.eq).toHaveBeenCalledWith("payment_status", "paid");
    expect(query.or).toHaveBeenCalledTimes(1);
  });

  it("getAdminDonationStats selects exact stats columns", async () => {
    const query = createQuery({ data: null, error: null });
    const supabase = { from: vi.fn(() => query) };
    getServerSupabaseClientMock.mockResolvedValue(supabase);

    await getAdminDonationStats();

    expect(supabase.from).toHaveBeenCalledWith("donation_stats");
    expect(query.select).toHaveBeenCalledWith(DONATION_STATS_SELECT_COLUMNS);
    expect(query.maybeSingle).toHaveBeenCalledTimes(1);
  });
});

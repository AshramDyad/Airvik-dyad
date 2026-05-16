import { beforeEach, describe, expect, it, vi } from "vitest";

const createClientMock = vi.hoisted(() => vi.fn());
const getServerSupabaseClientMock = vi.hoisted(() => vi.fn());
const unstableCacheMock = vi.hoisted(() => vi.fn((fn) => fn));

vi.mock("@supabase/supabase-js", () => ({
  createClient: createClientMock,
}));

vi.mock("@/lib/server/supabase", () => ({
  getServerSupabaseClient: getServerSupabaseClientMock,
}));

vi.mock("next/cache", () => ({
  unstable_cache: unstableCacheMock,
}));

import {
  getPropertyCurrency,
  PROPERTY_CURRENCY_CACHE_TAG,
  PROPERTY_CURRENCY_REVALIDATE_SECONDS,
  PROPERTY_CURRENCY_SELECT,
} from "./property";

const createQuery = (response: unknown) => {
  const query = {
    select: vi.fn(() => query),
    limit: vi.fn(() => query),
    maybeSingle: vi.fn(async () => response),
  };
  return query;
};

describe("property server helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://supabase.test";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
  });

  it("reads currency through a cached cookie-free public client", async () => {
    const query = createQuery({ data: { currency: "INR" }, error: null });
    const supabase = { from: vi.fn(() => query) };
    createClientMock.mockReturnValue(supabase);

    await expect(getPropertyCurrency()).resolves.toBe("INR");

    expect(createClientMock).toHaveBeenCalledWith(
      "https://supabase.test",
      "anon-key",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );
    expect(getServerSupabaseClientMock).not.toHaveBeenCalled();
    expect(supabase.from).toHaveBeenCalledWith("properties");
    expect(query.select).toHaveBeenCalledWith(PROPERTY_CURRENCY_SELECT);
    expect(query.limit).toHaveBeenCalledWith(1);
    expect(query.maybeSingle).toHaveBeenCalledTimes(1);
    expect(PROPERTY_CURRENCY_CACHE_TAG).toBe("property-currency");
    expect(PROPERTY_CURRENCY_REVALIDATE_SECONDS).toBe(3600);
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const unstableCacheMock = vi.hoisted(() => vi.fn((fn) => fn));
const createClientMock = vi.hoisted(() => vi.fn());

vi.mock("next/cache", () => ({
  unstable_cache: unstableCacheMock,
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: createClientMock,
}));

import {
  getCachedPublicAppProperty,
  getPublicAppPropertyUncached,
  getCachedPublicPropertyLocation,
  PUBLIC_APP_PROPERTY_CACHE_TAG,
  PUBLIC_APP_PROPERTY_REVALIDATE_SECONDS,
  PUBLIC_APP_PROPERTY_SELECT,
  getPublicPropertyLocationUncached,
  PUBLIC_PROPERTY_LOCATION_CACHE_TAG,
  PUBLIC_PROPERTY_LOCATION_REVALIDATE_SECONDS,
  PUBLIC_PROPERTY_LOCATION_SELECT,
} from "./public-property";

const createPropertyQuery = (response: unknown) => {
  const query = {
    from: vi.fn(() => query),
    select: vi.fn(() => query),
    limit: vi.fn(() => query),
    maybeSingle: vi.fn(async () => response),
  };
  return query;
};

describe("public property data access", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
  });

  it("declares a tagged cache policy for public layout location data", () => {
    expect(PUBLIC_PROPERTY_LOCATION_CACHE_TAG).toBe(
      "public-property-location"
    );
    expect(PUBLIC_PROPERTY_LOCATION_REVALIDATE_SECONDS).toBe(3600);
    expect(typeof getCachedPublicPropertyLocation).toBe("function");
  });

  it("declares a tagged cache policy for public app property data", () => {
    expect(PUBLIC_APP_PROPERTY_CACHE_TAG).toBe("public-app-property");
    expect(PUBLIC_APP_PROPERTY_REVALIDATE_SECONDS).toBe(3600);
    expect(typeof getCachedPublicAppProperty).toBe("function");
  });

  it("selects only address fields and trims nullable values", async () => {
    const query = createPropertyQuery({
      data: {
        address: "  Rishikesh  ",
        google_maps_url: "  https://maps.example/location  ",
      },
      error: null,
    });
    createClientMock.mockReturnValue(query);

    await expect(getPublicPropertyLocationUncached()).resolves.toEqual({
      address: "Rishikesh",
      google_maps_url: "https://maps.example/location",
    });

    expect(query.from).toHaveBeenCalledWith("properties");
    expect(query.select).toHaveBeenCalledWith(PUBLIC_PROPERTY_LOCATION_SELECT);
    expect(query.limit).toHaveBeenCalledWith(1);
    expect(query.maybeSingle).toHaveBeenCalledTimes(1);
    expect(createClientMock).toHaveBeenCalledWith(
      "https://example.supabase.co",
      "anon-key",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );
  });

  it("returns an empty location when the row is missing", async () => {
    const query = createPropertyQuery({ data: null, error: null });
    createClientMock.mockReturnValue(query);

    await expect(getPublicPropertyLocationUncached()).resolves.toEqual({
      address: "",
      google_maps_url: "",
    });
  });

  it("returns an empty location when Supabase env is unavailable at build time", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    await expect(getPublicPropertyLocationUncached()).resolves.toEqual({
      address: "",
      google_maps_url: "",
    });
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("selects only public app property fields and normalizes nullable values", async () => {
    const query = createPropertyQuery({
      data: {
        id: "property-1",
        name: "  Airvik  ",
        currency: "  INR  ",
        tax_enabled: true,
        tax_percentage: 12,
      },
      error: null,
    });
    createClientMock.mockReturnValue(query);

    await expect(getPublicAppPropertyUncached()).resolves.toEqual({
      id: "property-1",
      name: "Airvik",
      currency: "INR",
      tax_enabled: true,
      tax_percentage: 12,
    });

    expect(query.from).toHaveBeenCalledWith("properties");
    expect(query.select).toHaveBeenCalledWith(PUBLIC_APP_PROPERTY_SELECT);
    expect(query.limit).toHaveBeenCalledWith(1);
    expect(query.maybeSingle).toHaveBeenCalledTimes(1);
  });
});

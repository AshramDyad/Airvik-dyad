import "server-only";

import { createClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";

import type { Property } from "@/data/types";

export const PUBLIC_PROPERTY_LOCATION_SELECT =
  "address, google_maps_url" as const;
export const PUBLIC_APP_PROPERTY_SELECT =
  "id, name, currency, tax_enabled, tax_percentage" as const;
export const PUBLIC_PROPERTY_LOCATION_CACHE_TAG = "public-property-location";
export const PUBLIC_APP_PROPERTY_CACHE_TAG = "public-app-property";
export const PUBLIC_PROPERTY_LOCATION_REVALIDATE_SECONDS = 3600;
export const PUBLIC_APP_PROPERTY_REVALIDATE_SECONDS = 3600;

type PropertyLocation = Pick<Property, "address" | "google_maps_url">;
type PublicAppProperty = Pick<
  Property,
  "id" | "name" | "currency" | "tax_enabled" | "tax_percentage"
>;

const emptyLocation: PropertyLocation = {
  address: "",
  google_maps_url: "",
};

const emptyAppProperty: Partial<PublicAppProperty> = {};

const normalizeLocation = (
  row?: Partial<PropertyLocation> | null
): PropertyLocation => ({
  address: row?.address?.trim() ?? "",
  google_maps_url: row?.google_maps_url?.trim() ?? "",
});

const normalizeAppProperty = (
  row?: Partial<PublicAppProperty> | null,
): Partial<PublicAppProperty> => {
  if (!row) {
    return emptyAppProperty;
  }

  return {
    id: row.id,
    name: row.name?.trim() ?? "",
    currency: row.currency?.trim() ?? "INR",
    tax_enabled: Boolean(row.tax_enabled),
    tax_percentage: row.tax_percentage ?? 0,
  };
};

const createPublicReadClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
};

export async function getPublicPropertyLocationUncached(): Promise<PropertyLocation> {
  const supabase = createPublicReadClient();
  if (!supabase) {
    return emptyLocation;
  }

  const { data, error } = await supabase
    .from("properties")
    .select(PUBLIC_PROPERTY_LOCATION_SELECT)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Error fetching public property location", error);
    return emptyLocation;
  }

  return normalizeLocation(data);
}

export async function getPublicAppPropertyUncached(): Promise<
  Partial<PublicAppProperty>
> {
  const supabase = createPublicReadClient();
  if (!supabase) {
    return emptyAppProperty;
  }

  const { data, error } = await supabase
    .from("properties")
    .select(PUBLIC_APP_PROPERTY_SELECT)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Error fetching public app property", error);
    return emptyAppProperty;
  }

  return normalizeAppProperty(data);
}

export const getCachedPublicPropertyLocation = unstable_cache(
  getPublicPropertyLocationUncached,
  ["public-property-location"],
  {
    revalidate: PUBLIC_PROPERTY_LOCATION_REVALIDATE_SECONDS,
    tags: [PUBLIC_PROPERTY_LOCATION_CACHE_TAG],
  }
);

export const getCachedPublicAppProperty = unstable_cache(
  getPublicAppPropertyUncached,
  ["public-app-property"],
  {
    revalidate: PUBLIC_APP_PROPERTY_REVALIDATE_SECONDS,
    tags: [PUBLIC_APP_PROPERTY_CACHE_TAG],
  },
);

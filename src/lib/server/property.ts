import "server-only";
import { createClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import { DEFAULT_CURRENCY } from "@/lib/currency";

export const PROPERTY_CURRENCY_SELECT = "currency" as const;
export const PROPERTY_CURRENCY_CACHE_TAG = "property-currency";
export const PROPERTY_CURRENCY_REVALIDATE_SECONDS = 3600;

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

async function getPropertyCurrencyUncached(): Promise<string> {
  try {
    const supabase = createPublicReadClient();
    if (!supabase) {
      return DEFAULT_CURRENCY;
    }

    const { data } = await supabase
      .from("properties")
      .select(PROPERTY_CURRENCY_SELECT)
      .limit(1)
      .maybeSingle();
    return data?.currency ?? DEFAULT_CURRENCY;
  } catch {
    return DEFAULT_CURRENCY;
  }
}

export const getPropertyCurrency = unstable_cache(
  getPropertyCurrencyUncached,
  ["property-currency"],
  {
    revalidate: PROPERTY_CURRENCY_REVALIDATE_SECONDS,
    tags: [PROPERTY_CURRENCY_CACHE_TAG],
  }
);

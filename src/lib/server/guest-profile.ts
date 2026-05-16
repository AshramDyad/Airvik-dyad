import "server-only";

import type { Guest } from "@/data/types";
import { createServerSupabaseClient } from "@/integrations/supabase/server";

export const GUEST_PROFILE_SELECT_COLUMNS =
  "id, first_name, last_name, email, phone, address, pincode, city, state, country" as const;

type DbGuestProfileRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  pincode: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
};

const mapGuestProfile = (row: DbGuestProfileRow): Guest => ({
  id: row.id,
  firstName: row.first_name ?? "",
  lastName: row.last_name ?? "",
  email: row.email ?? "",
  phone: row.phone ?? "",
  address: row.address ?? "",
  pincode: row.pincode ?? "",
  city: row.city ?? "",
  state: row.state ?? "",
  country: row.country ?? "",
});

export async function getGuestProfile(id: string): Promise<Guest | null> {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("guests")
    .select(GUEST_PROFILE_SELECT_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data ? mapGuestProfile(data as DbGuestProfileRow) : null;
}

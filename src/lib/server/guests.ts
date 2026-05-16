import "server-only";

import type { Guest } from "@/data/types";
import type { GuestsPageResponse } from "@/lib/guests/list";
import { createServerSupabaseClient } from "@/integrations/supabase/server";

const DEFAULT_PAGE_LIMIT = 25;
const MAX_PAGE_LIMIT = 100;

export const GUEST_PAGE_SELECT_COLUMNS =
  "id, first_name, last_name, email, phone, address, pincode, city, state, country, created_at" as const;

type GuestsPageParams = {
  limit?: number;
  offset?: number;
  query?: string;
};

type DbGuestPageRow = {
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
  created_at?: string | null;
};

const normalizeGuestsPageParams = (
  params: GuestsPageParams = {},
): Required<GuestsPageParams> => {
  const limit = Math.min(
    Math.max(Number(params.limit ?? DEFAULT_PAGE_LIMIT), 1),
    MAX_PAGE_LIMIT,
  );
  const offset = Math.max(Number(params.offset ?? 0), 0);
  const query = params.query?.trim() ?? "";

  return { limit, offset, query };
};

const normalizeSearchTerm = (query: string) =>
  query
    .replace(/[,%()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const mapGuestPageRow = (row: DbGuestPageRow): Guest => ({
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

export async function getGuestsPage(
  params: GuestsPageParams = {},
): Promise<GuestsPageResponse> {
  const normalized = normalizeGuestsPageParams(params);
  const supabase = createServerSupabaseClient();
  const toIndex = normalized.offset + normalized.limit - 1;

  let queryBuilder = supabase
    .from("guests")
    .select(GUEST_PAGE_SELECT_COLUMNS, { count: "exact" });

  const searchTerm = normalizeSearchTerm(normalized.query);
  if (searchTerm) {
    const pattern = `%${searchTerm}%`;
    queryBuilder = queryBuilder.or(
      `first_name.ilike.${pattern},last_name.ilike.${pattern},email.ilike.${pattern},phone.ilike.${pattern}`,
    );
  }

  const { data, error, count } = await queryBuilder
    .order("created_at", { ascending: false, nullsFirst: false })
    .range(normalized.offset, toIndex);

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to load guests");
  }

  const guests = (data as DbGuestPageRow[]).map(mapGuestPageRow);
  const nextOffset =
    typeof count === "number"
      ? normalized.offset + guests.length < count
        ? normalized.offset + guests.length
        : null
      : guests.length < normalized.limit
        ? null
        : normalized.offset + guests.length;

  return {
    data: guests,
    nextOffset,
    count: count ?? null,
  };
}

export const clampGuestsPageParams = normalizeGuestsPageParams;

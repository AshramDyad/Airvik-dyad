import "server-only";

import { unstable_cache } from "next/cache";

import type { Reservation, ReservationPageResult } from "@/data/types";
import { createServerSupabaseClient } from "@/integrations/supabase/server";

const DEFAULT_PAGE_LIMIT = 50;
const MAX_PAGE_LIMIT = 500;

export const RESERVATIONS_CACHE_TAG = "reservations";
export const RESERVATIONS_COUNT_CACHE_TAG = "reservations:count";

export type DbBookingSummaryRow = {
  booking_id: string;
  booking_date: string;
  guest_id: string;
  guest_first_name: string | null;
  guest_last_name: string | null;
  guest_name: string | null;
  guest_email: string | null;
  guest_phone: string | null;
  total_amount: number;
  room_count: number;
  check_in_date: string;
  check_out_date: string;
  number_of_guests: number;
  adult_count: number;
  child_count: number;
  status: Reservation["status"];
  reservation_rows: (Reservation & { roomNumber: string })[];
};

type ReservationPageParams = {
  limit?: number;
  offset?: number;
  query?: string;
};

const normalizePageParams = (params: ReservationPageParams = {}): Required<ReservationPageParams> => {
  const limit = Math.min(
    Math.max(Number(params.limit ?? DEFAULT_PAGE_LIMIT), 1),
    MAX_PAGE_LIMIT
  );
  const offset = Math.max(Number(params.offset ?? 0), 0);
  const query = params.query?.trim() ?? "";
  return { limit, offset, query };
};

export const mapBookingSummaryRow = (row: DbBookingSummaryRow) => {
  const reservationRows = row.reservation_rows || [];

  const validSubRows = reservationRows.map((r) => ({
    ...r,
    guestName: row.guest_name || "N/A",
    nights: 0,
    folio: r.folio || [],
  }));

  // Resolve the best primary room number
  const firstValidRoom = validSubRows.find(sub => sub.roomNumber && sub.roomNumber !== "N/A");
  const primaryRoomNumber = row.room_count === 1
    ? (firstValidRoom?.roomNumber || "N/A")
    : "N/A";

  return {
    id: row.booking_id,
    bookingId: row.booking_id,
    bookingDate: row.booking_date,
    guestId: row.guest_id,
    guestName: row.guest_name || "N/A",
    guestSnapshot: {
      firstName: row.guest_first_name,
      lastName: row.guest_last_name,
      email: row.guest_email,
      phone: row.guest_phone,
    },
    totalAmount: row.total_amount,
    roomCount: row.room_count,
    checkInDate: row.check_in_date,
    checkOutDate: row.check_out_date,
    numberOfGuests: row.number_of_guests,
    adultCount: row.adult_count,
    childCount: row.child_count,
    status: row.status,
    source: validSubRows[0]?.source || "reception",
    paymentMethod: validSubRows[0]?.paymentMethod || "Not specified",
    nights: 0,
    roomNumber: primaryRoomNumber,
    folio: [], // Folios are in subRows
    subRows: validSubRows,
  };
};

const fetchReservationPage = async (params: Required<ReservationPageParams>) => {
  const supabase = createServerSupabaseClient();
  const toIndex = params.offset + params.limit - 1;

  let queryBuilder = supabase
    .from("bookings_summary_view")
    .select("*", { count: "exact" });

  if (params.query) {
    const searchTerm = `%${params.query}%`;
    queryBuilder = queryBuilder.or(
      `booking_id.ilike.${searchTerm},guest_name.ilike.${searchTerm},guest_email.ilike.${searchTerm}`
    );
  }

  const { data, error, count } = await queryBuilder
    .order("booking_date", { ascending: false, nullsFirst: false })
    .range(params.offset, toIndex);

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to load reservations");
  }

  const rows = data as DbBookingSummaryRow[];
  const bookings = rows.map((row) => mapBookingSummaryRow(row));
  const nextOffset =
    bookings.length < params.limit
      ? null
      : params.offset + bookings.length;

  return {
    data: bookings,
    nextOffset,
    totalCount: count ?? null,
  } satisfies ReservationPageResult;
};

const reservationsPageCache = unstable_cache(
  async (limit: number, offset: number, query: string) => {
    const normalized = normalizePageParams({ limit, offset, query });
    return fetchReservationPage(normalized);
  },
  ["reservations-page"],
  {
    revalidate: 120,
    tags: [RESERVATIONS_CACHE_TAG],
  }
);

export const getCachedReservationsPage = async (
  params: ReservationPageParams = {}
): Promise<ReservationPageResult> => {
  const normalized = normalizePageParams(params);
  return reservationsPageCache(
    normalized.limit,
    normalized.offset,
    normalized.query
  );
};

const reservationsCountCache = unstable_cache(
  async () => {
    const supabase = createServerSupabaseClient();
    const { data, error } = await supabase.rpc("get_total_bookings");
    if (error) {
      console.error("Failed to fetch total bookings count:", error);
      return null;
    }
    const numericCount =
      typeof data === "number"
        ? data
        : data === null || typeof data === "undefined"
          ? 0
          : Number(data);
    return Number.isFinite(numericCount) ? numericCount : 0;
  },
  ["reservations-count"],
  {
    revalidate: 300,
    tags: [RESERVATIONS_COUNT_CACHE_TAG],
  }
);

export const getCachedReservationsCount = (): Promise<number | null> =>
  reservationsCountCache();

export const clampReservationPageParams = normalizePageParams;

import type {
  Donation,
  DonationFrequency,
  DonationStats,
  DonationStatus,
} from "@/data/types";
import {
  DONATION_SELECT_COLUMNS,
  DONATION_STATS_SELECT_COLUMNS,
  type DonationListFilters,
} from "@/lib/api/donations";
import { getServerSupabaseClient } from "@/lib/server/supabase";

type DbDonation = {
  id: string;
  donor_name: string;
  email: string;
  phone: string;
  amount_in_minor: number;
  currency: string;
  frequency: DonationFrequency;
  message: string | null;
  consent: boolean;
  payment_provider: string;
  payment_status: DonationStatus;
  razorpay_order_id: string | null;
  razorpay_payment_id: string | null;
  razorpay_signature: string | null;
  upi_reference: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

type DbDonationStats = {
  total_amount_in_minor: number | null;
  total_donations: number | null;
  monthly_donations: number | null;
  last_donation_at: string | null;
};

const fromDbDonation = (row: DbDonation): Donation => ({
  id: row.id,
  donorName: row.donor_name,
  email: row.email,
  phone: row.phone,
  amountInMinor: row.amount_in_minor,
  currency: row.currency,
  frequency: row.frequency,
  message: row.message ?? undefined,
  consent: row.consent,
  paymentProvider: row.payment_provider,
  paymentStatus: row.payment_status,
  razorpayOrderId: row.razorpay_order_id ?? undefined,
  razorpayPaymentId: row.razorpay_payment_id ?? undefined,
  razorpaySignature: row.razorpay_signature ?? undefined,
  upiReference: row.upi_reference ?? undefined,
  metadata: row.metadata ?? undefined,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const fromDbStats = (row: DbDonationStats | null): DonationStats => ({
  totalAmountInMinor: row?.total_amount_in_minor ?? 0,
  totalDonations: row?.total_donations ?? 0,
  monthlyDonations: row?.monthly_donations ?? 0,
  lastDonationAt: row?.last_donation_at ?? undefined,
});

export async function getAdminDonations(
  filters: DonationListFilters = {}
): Promise<Donation[]> {
  const supabase = await getServerSupabaseClient();
  let query = supabase
    .from("donations")
    .select(DONATION_SELECT_COLUMNS)
    .order("created_at", { ascending: false });

  if (filters.status) {
    query = query.eq("payment_status", filters.status);
  }

  if (filters.frequency) {
    query = query.eq("frequency", filters.frequency);
  }

  if (filters.from) {
    query = query.gte("created_at", filters.from);
  }

  if (filters.to) {
    query = query.lte("created_at", filters.to);
  }

  if (filters.query) {
    const sanitized = filters.query.trim().replace(/[,]/g, "");
    if (sanitized.length > 0) {
      const like = `%${sanitized}%`;
      query = query.or(
        [
          `donor_name.ilike.${like}`,
          `email.ilike.${like}`,
          `phone.ilike.${like}`,
          `razorpay_payment_id.ilike.${like}`,
          `razorpay_order_id.ilike.${like}`,
        ].join(",")
      );
    }
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message ?? "Unable to fetch donations");
  }

  const rows = (data ?? []) as DbDonation[];
  return rows.map(fromDbDonation);
}

export async function getAdminDonationStats(): Promise<DonationStats> {
  const supabase = await getServerSupabaseClient();
  const { data, error } = await supabase
    .from("donation_stats")
    .select(DONATION_STATS_SELECT_COLUMNS)
    .maybeSingle();

  if (error) {
    throw new Error(error.message ?? "Unable to load donation stats");
  }

  return fromDbStats(data as DbDonationStats | null);
}

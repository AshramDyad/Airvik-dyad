import type {
  Donation,
  DonationFrequency,
  DonationStats,
  DonationStatus,
} from "@/data/types";
import { createServerSupabaseClient } from "@/integrations/supabase/server";

// Column selection to reduce egress
export const DONATION_SELECT_COLUMNS = 'id, donor_name, email, phone, amount_in_minor, currency, frequency, message, consent, payment_provider, payment_status, razorpay_order_id, razorpay_payment_id, razorpay_signature, upi_reference, metadata, created_at, updated_at' as const;
export const DONATION_CREATE_RETURN_COLUMNS = "id, created_at, updated_at" as const;
export const DONATION_ID_SELECT_COLUMNS = "id" as const;
export const DONATION_STATS_SELECT_COLUMNS =
  "total_amount_in_minor, total_donations, monthly_donations, last_donation_at" as const;
export const DONATION_UPDATE_TIMESTAMP_COLUMNS = "updated_at" as const;

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

type DbDonationCreateReturn = Pick<DbDonation, "id" | "created_at" | "updated_at">;
type DbDonationUpdateTimestamp = Pick<DbDonation, "updated_at">;

type DbDonationStats = {
  total_amount_in_minor: number | null;
  total_donations: number | null;
  monthly_donations: number | null;
  last_donation_at: string | null;
};

export type CreateDonationInput = {
  donorName: string;
  email: string;
  phone: string;
  amountInMinor: number;
  currency: string;
  frequency: DonationFrequency;
  message?: string;
  consent: boolean;
  paymentProvider: string;
  paymentStatus?: DonationStatus;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  razorpaySignature?: string;
  upiReference?: string;
  metadata?: Record<string, unknown>;
};

export type UpdateDonationInput = Partial<
  Pick<
    CreateDonationInput,
    | "donorName"
    | "email"
    | "phone"
    | "amountInMinor"
    | "currency"
    | "frequency"
    | "message"
    | "consent"
    | "paymentProvider"
    | "paymentStatus"
    | "razorpayOrderId"
    | "razorpayPaymentId"
    | "razorpaySignature"
    | "upiReference"
    | "metadata"
  >
>;

export type DonationListFilters = {
  query?: string;
  status?: DonationStatus;
  frequency?: DonationFrequency;
  from?: string;
  to?: string;
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

const toDonationUpdatePayload = (input: UpdateDonationInput): Record<string, unknown> => {
  const payload: Record<string, unknown> = {};

  if (typeof input.donorName !== "undefined") payload.donor_name = input.donorName;
  if (typeof input.email !== "undefined") payload.email = input.email;
  if (typeof input.phone !== "undefined") payload.phone = input.phone;
  if (typeof input.amountInMinor !== "undefined") payload.amount_in_minor = input.amountInMinor;
  if (typeof input.currency !== "undefined") payload.currency = input.currency;
  if (typeof input.frequency !== "undefined") payload.frequency = input.frequency;
  if (typeof input.message !== "undefined") payload.message = input.message ?? null;
  if (typeof input.consent !== "undefined") payload.consent = input.consent;
  if (typeof input.paymentProvider !== "undefined") payload.payment_provider = input.paymentProvider;
  if (typeof input.paymentStatus !== "undefined") payload.payment_status = input.paymentStatus;
  if (typeof input.razorpayOrderId !== "undefined") payload.razorpay_order_id = input.razorpayOrderId;
  if (typeof input.razorpayPaymentId !== "undefined") payload.razorpay_payment_id = input.razorpayPaymentId;
  if (typeof input.razorpaySignature !== "undefined") payload.razorpay_signature = input.razorpaySignature;
  if (typeof input.upiReference !== "undefined") payload.upi_reference = input.upiReference;
  if (typeof input.metadata !== "undefined") payload.metadata = input.metadata;

  return payload;
};

export async function createDonationRecord(input: CreateDonationInput): Promise<Donation> {
  const supabase = createServerSupabaseClient();
  const insertPayload: Omit<DbDonation, "id" | "created_at" | "updated_at"> = {
    donor_name: input.donorName,
    email: input.email,
    phone: input.phone,
    amount_in_minor: input.amountInMinor,
    currency: input.currency,
    frequency: input.frequency,
    message: input.message ?? null,
    consent: input.consent,
    payment_provider: input.paymentProvider,
    payment_status: input.paymentStatus ?? "pending",
    razorpay_order_id: input.razorpayOrderId ?? null,
    razorpay_payment_id: input.razorpayPaymentId ?? null,
    razorpay_signature: input.razorpaySignature ?? null,
    upi_reference: input.upiReference ?? null,
    metadata: input.metadata ?? {},
  };

  const { data, error } = await supabase
    .from("donations")
    .insert(insertPayload)
    .select(DONATION_CREATE_RETURN_COLUMNS)
    .single();

  if (error) {
    throw new Error(`Failed to create donation: ${error.message}`);
  }

  const generated = data as DbDonationCreateReturn | null;
  if (!generated) {
    throw new Error("Failed to create donation: no row returned");
  }

  return fromDbDonation({
    id: generated.id,
    ...insertPayload,
    created_at: generated.created_at,
    updated_at: generated.updated_at,
  });
}

export async function getDonations(filters: DonationListFilters = {}): Promise<Donation[]> {
  const supabase = createServerSupabaseClient();
  let query = supabase.from("donations").select(DONATION_SELECT_COLUMNS).order("created_at", { ascending: false });

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
    const sanitized = filters.query.trim();
    if (sanitized.length > 0) {
      const like = `%${sanitized}%`;
      query = query.or(
        [
          `donor_name.ilike.${like}`,
          `email.ilike.${like}`,
          `phone.ilike.${like}`,
          `razorpay_payment_id.ilike.${like}`,
          `razorpay_order_id.ilike.${like}`,
        ].join(","),
      );
    }
  }

  const { data, error } = await query;

  if (error) {
    console.warn("Unable to fetch donations", error.message);
    return [];
  }

  return (data as DbDonation[]).map(fromDbDonation);
}

export async function updateDonationRecord(
  donationId: string,
  input: UpdateDonationInput,
): Promise<Donation> {
  const supabase = createServerSupabaseClient();
  const payload = toDonationUpdatePayload(input);

  const { data, error } = await supabase
    .from("donations")
    .update(payload)
    .eq("id", donationId)
    .select(DONATION_SELECT_COLUMNS)
    .single();

  if (error) {
    throw new Error(`Failed to update donation: ${error.message}`);
  }

  return fromDbDonation(data as DbDonation);
}

export async function updateDonationRecordTimestampOnly(
  donationId: string,
  input: UpdateDonationInput,
): Promise<{ updatedAt: string }> {
  const supabase = createServerSupabaseClient();
  const payload = toDonationUpdatePayload(input);

  const { data, error } = await supabase
    .from("donations")
    .update(payload)
    .eq("id", donationId)
    .select(DONATION_UPDATE_TIMESTAMP_COLUMNS)
    .single();

  if (error) {
    throw new Error(`Failed to update donation: ${error.message}`);
  }

  const row = data as DbDonationUpdateTimestamp | null;
  if (!row) {
    throw new Error("Failed to update donation: no row returned");
  }

  return { updatedAt: row.updated_at };
}

export async function updateDonationRecordWithoutReturning(
  donationId: string,
  input: UpdateDonationInput,
): Promise<void> {
  const supabase = createServerSupabaseClient();
  const payload = toDonationUpdatePayload(input);

  const { error } = await supabase
    .from("donations")
    .update(payload)
    .eq("id", donationId);

  if (error) {
    throw new Error(`Failed to update donation: ${error.message}`);
  }
}

export async function getDonationById(id: string): Promise<Donation | null> {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("donations")
    .select(DONATION_SELECT_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load donation: ${error.message}`);
  }

  return data ? fromDbDonation(data as DbDonation) : null;
}

export async function getDonationIdByOrderId(orderId: string): Promise<string | null> {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("donations")
    .select(DONATION_ID_SELECT_COLUMNS)
    .eq("razorpay_order_id", orderId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load donation id by order id: ${error.message}`);
  }

  return typeof data?.id === "string" ? data.id : null;
}

export async function getDonationByOrderId(orderId: string): Promise<Donation | null> {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("donations")
    .select(DONATION_SELECT_COLUMNS)
    .eq("razorpay_order_id", orderId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load donation by order id: ${error.message}`);
  }

  return data ? fromDbDonation(data as DbDonation) : null;
}

export async function getDonationStats(): Promise<DonationStats> {
  try {
    const supabase = createServerSupabaseClient();
    const { data, error } = await supabase
      .from("donation_stats")
      .select(DONATION_STATS_SELECT_COLUMNS)
      .maybeSingle();

    if (error) {
      console.warn("Unable to read donation stats, returning defaults", error.message);
      return fromDbStats(null);
    }

    return fromDbStats(data as DbDonationStats | null);
  } catch {
    return fromDbStats(null);
  }
}

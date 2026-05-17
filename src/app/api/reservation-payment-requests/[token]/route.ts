import { NextResponse } from "next/server";

import { createServerSupabaseClient } from "@/integrations/supabase/server";
import { normalizeReservationPaymentRequestStatus } from "@/lib/payments/reservation-payment-requests";

type DbReservationForPaymentRequest = {
  id: string;
  booking_id: string;
  check_in_date: string;
  check_out_date: string;
  guest?: {
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    phone: string | null;
  } | Array<{
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    phone: string | null;
  }> | null;
};

type DbReservationPaymentRequest = {
  id: string;
  token: string;
  reservation_ids: string[];
  amount: number;
  paid_amount: number;
  status: string;
  notes: string | null;
  requested_at: string;
  paid_at: string | null;
  expires_at: string | null;
  payment_method: string;
  payment_reference: string | null;
  created_at: string;
  updated_at: string;
};

type DbProperty = {
  id: string;
  name: string | null;
  upi_id: string | null;
  upi_merchant_name: string | null;
  currency: string | null;
};

type PaymentRequestReservationSummary = {
  reservationId: string;
  bookingId: string;
  checkInDate: string;
  checkOutDate: string;
  guestName: string;
  guestEmail?: string;
  guestPhone?: string;
};

const mapRequest = (row: DbReservationPaymentRequest) => ({
  id: row.id,
  token: row.token,
  reservationIds: row.reservation_ids,
  amount: Number(row.amount),
  paidAmount: Number(row.paid_amount),
  status: row.status,
  notes: row.notes ?? undefined,
  requestedAt: row.requested_at,
  paidAt: row.paid_at ?? undefined,
  expiresAt: row.expires_at ?? undefined,
  paymentMethod: row.payment_method,
  paymentReference: row.payment_reference ?? undefined,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const buildGuestName = (
  firstName: string | null | undefined,
  lastName: string | null | undefined
) => {
  const resolvedFirstName = firstName?.trim();
  const resolvedLastName = lastName?.trim();
  const name = [resolvedFirstName, resolvedLastName]
    .filter(Boolean)
    .join(" ")
    .trim();
  return name || "Guest";
};

const mapReservationSummary = (
  row: DbReservationForPaymentRequest
): PaymentRequestReservationSummary => ({
  reservationId: row.id,
  bookingId: row.booking_id,
  checkInDate: row.check_in_date,
  checkOutDate: row.check_out_date,
  guestName: buildGuestName(
    Array.isArray(row.guest)
      ? row.guest[0]?.first_name
      : row.guest?.first_name,
    Array.isArray(row.guest)
      ? row.guest[0]?.last_name
      : row.guest?.last_name
  ),
  guestEmail: Array.isArray(row.guest)
    ? row.guest[0]?.email ?? undefined
    : row.guest?.email ?? undefined,
  guestPhone: Array.isArray(row.guest)
    ? row.guest[0]?.phone ?? undefined
    : row.guest?.phone ?? undefined,
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const cleaned = (token || "").trim();

  if (!cleaned) {
    return NextResponse.json({ message: "Token is required." }, { status: 400 });
  }

  const supabase = createServerSupabaseClient();

  const { data: requestRow, error: requestError } = await supabase
    .from("reservation_payment_requests")
    .select("*")
    .eq("token", cleaned)
    .maybeSingle();

  if (requestError) {
    console.error("Failed to fetch reservation payment request", requestError);
    return NextResponse.json(
      { message: "Unable to load reservation payment request." },
      { status: 500 }
    );
  }

  if (!requestRow) {
    return NextResponse.json(
      { message: "Reservation payment request not found." },
      { status: 404 }
    );
  }

  const { data: propertyRow } = await supabase
    .from("properties")
    .select("id, name, currency, upi_id, upi_merchant_name")
    .limit(1)
    .maybeSingle();

  const reservationIds = Array.isArray(requestRow.reservation_ids)
    ? requestRow.reservation_ids
    : [];
  const shouldFetchReservations = reservationIds.length > 0;
  const { data: reservationRows, error: reservationError } = shouldFetchReservations
    ? await supabase
      .from("reservations")
      .select(
        "id, booking_id, check_in_date, check_out_date, guest:guests(first_name,last_name,email,phone)"
      )
      .in("id", reservationIds)
    : { data: [] as DbReservationForPaymentRequest[], error: null };

  if (reservationError) {
    console.error("Failed to fetch reservations for payment request", reservationError);
  }

  const reservationSummaries = (reservationRows ?? []).map(mapReservationSummary);

  const request = mapRequest(requestRow as DbReservationPaymentRequest);
  const effectiveStatus = normalizeReservationPaymentRequestStatus(
    request.status,
    request.expiresAt
  );

  if (
    request.status !== "expired" &&
    effectiveStatus === "expired"
  ) {
    const { error: updateError } = await supabase
      .from("reservation_payment_requests")
      .update({ status: "expired", updated_at: new Date().toISOString() })
      .eq("id", request.id);

    if (updateError) {
      console.error(
        "Failed to persist expired reservation payment request",
        updateError
      );
    }
  }

  return NextResponse.json({
    data: {
      request: {
        ...request,
        status: effectiveStatus,
      },
      reservations: reservationSummaries,
      property: propertyRow
        ? {
          id: (propertyRow as DbProperty).id,
            name: (propertyRow as DbProperty).name ?? "Hotel",
            currency: (propertyRow as DbProperty).currency ?? "INR",
            upiId: (propertyRow as DbProperty).upi_id || undefined,
            upiMerchantName:
              (propertyRow as DbProperty).upi_merchant_name ||
              (propertyRow as DbProperty).name ||
              undefined,
          }
        : null,
    },
  });
}

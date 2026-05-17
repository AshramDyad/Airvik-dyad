import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import type { ReservationPaymentRequestStatus } from "@/data/types";
import { createServerSupabaseClient } from "@/integrations/supabase/server";
import { HttpError, requirePermission } from "@/lib/server/auth";
import { normalizeReservationPaymentRequestStatus } from "@/lib/payments/reservation-payment-requests";

const reservationIdsSchema = z.array(z.string().uuid()).min(1, "At least one reservation is required.");
const reservationIdSchema = z.string().uuid("reservationId must be a valid UUID.");

const createSchema = z.object({
  reservationIds: reservationIdsSchema,
  amount: z.number({ invalid_type_error: "Amount must be a number." }).positive("Amount must be greater than 0."),
  notes: z.string().trim().max(500, "Notes must be 500 characters or fewer").optional(),
  requestedAt: z.string().optional(),
  expiresAt: z.string().optional(),
  paymentMethod: z.string().trim().optional(),
});

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
  external_metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

type ReservationPaymentRequestPayload = {
  id: string;
  token: string;
  reservationIds: string[];
  amount: number;
  paidAmount: number;
  status: ReservationPaymentRequestStatus;
  notes?: string;
  requestedAt: string;
  paidAt?: string;
  expiresAt?: string;
  paymentMethod: string;
  paymentReference?: string;
  externalMetadata?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
};

const mapRow = (row: DbReservationPaymentRequest): ReservationPaymentRequestPayload => ({
  id: row.id,
  token: row.token,
  reservationIds: row.reservation_ids,
  amount: Number(row.amount),
  paidAmount: Number(row.paid_amount),
  status: normalizeReservationPaymentRequestStatus(row.status, row.expires_at),
  notes: row.notes ?? undefined,
  requestedAt: row.requested_at,
  paidAt: row.paid_at ?? undefined,
  expiresAt: row.expires_at ?? undefined,
  paymentMethod: row.payment_method,
  paymentReference: row.payment_reference ?? undefined,
  externalMetadata: row.external_metadata ?? undefined,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const normalizeAmount = (value: number) => Math.round(value * 100) / 100;

const parseRequestQuery = (request: NextRequest) => {
  const url = new URL(request.url);
  return url.searchParams.get("reservationId")?.trim() ?? "";
};

export async function GET(request: NextRequest) {
  try {
    await requirePermission(request, "read:reservation");
    const reservationId = reservationIdSchema.parse(parseRequestQuery(request));

    const supabase = createServerSupabaseClient();
    const { data, error } = await supabase
      .from("reservation_payment_requests")
      .select("*")
      .contains("reservation_ids", [reservationId])
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Failed to load reservation payment requests", error);
      return NextResponse.json(
        { message: "Unable to load reservation payment requests." },
        { status: 500 }
      );
    }

    const now = Date.now();
    const requestRows = (data ?? []) as DbReservationPaymentRequest[];
    const expiredIds = requestRows
      .filter((row) => {
        const mappedStatus = normalizeReservationPaymentRequestStatus(
          row.status,
          row.expires_at,
          now
        );
        return row.status !== "expired" && mappedStatus === "expired";
      })
      .map((row) => row.id);

    if (expiredIds.length > 0) {
      const { error: updateError } = await supabase
        .from("reservation_payment_requests")
        .update({ status: "expired", updated_at: new Date().toISOString() })
        .in("id", expiredIds);

      if (updateError) {
        console.error("Failed to persist expired reservation payment requests", updateError);
      }
    }

    return NextResponse.json({
      data: requestRows.map((row) => mapRow(row)),
    });
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: "Invalid query", issues: error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    console.error("Unexpected reservation payment request fetch error", error);
    return NextResponse.json(
      { message: "Unexpected error while loading reservation payment requests." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const profile = await requirePermission(request, "create:reservation");
    const body = await request.json();
    const payload = createSchema.parse(body);

    const now = new Date().toISOString();
    const token = crypto.randomUUID
      ? crypto.randomUUID().replace(/-/g, "").slice(0, 20)
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
    const amount = normalizeAmount(payload.amount);
    const requestedAt = payload.requestedAt?.trim() || now;
    const expiresAt = payload.expiresAt?.trim() || null;

    const supabase = createServerSupabaseClient();
    const { data, error } = await supabase
      .from("reservation_payment_requests")
      .insert({
        token,
        reservation_ids: payload.reservationIds,
        amount,
        paid_amount: 0,
        status: "requested",
        notes: payload.notes?.trim() || null,
        requested_at: requestedAt,
        paid_at: null,
        expires_at: expiresAt,
        payment_method: payload.paymentMethod?.trim() || "UPI",
        payment_reference: null,
        external_metadata: {},
        created_by: profile.userId,
      })
      .select("*")
      .single();

    if (error) {
      console.error("Failed to create reservation payment request", error);
      return NextResponse.json(
        { message: "Unable to create reservation payment request." },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { message: "Reservation payment request could not be created." },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { data: mapRow(data as DbReservationPaymentRequest) },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: "Invalid payload", issues: error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    console.error("Unexpected reservation payment request create error", error);
    return NextResponse.json(
      { message: "Unexpected error while creating reservation payment request." },
      { status: 500 }
    );
  }
}

export async function PATCH() {
  return NextResponse.json({ message: "Method not allowed" }, { status: 405 });
}

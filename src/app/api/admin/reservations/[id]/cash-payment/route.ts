import { NextResponse } from "next/server";
import { z } from "zod";

import { createServerSupabaseClient } from "@/integrations/supabase/server";
import { HttpError, requirePermission } from "@/lib/server/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CashPaymentSchema = z.object({
  amount: z.coerce.number().positive(),
});

type DbReservationPaymentGuard = {
  id: string;
  status: string;
  payment_method: string | null;
};

type DbCashFolioItem = {
  id: string;
  reservation_id: string | null;
  description: string;
  amount: number | string;
  timestamp: string | null;
  payment_method: string | null;
  transaction_id: string | null;
  external_source: string | null;
  external_reference: string | null;
  external_metadata: Record<string, unknown> | null;
  received_by: string | null;
  received_at: string | null;
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const profile = await requirePermission(request, "update:reservation");
    const { id } = await params;
    const payload = CashPaymentSchema.parse(await request.json());
    const supabase = createServerSupabaseClient();

    const { data: reservation, error: reservationError } = await supabase
      .from("reservations")
      .select("id, status, payment_method")
      .eq("id", id)
      .maybeSingle();

    if (reservationError) {
      throw new Error(reservationError.message);
    }

    if (!reservation) {
      return noStoreJson({ message: "Reservation not found." }, { status: 404 });
    }

    const guardedReservation = reservation as unknown as DbReservationPaymentGuard;
    if (guardedReservation.payment_method === "UPI Gateway") {
      return noStoreJson(
        {
          message:
            "UPI Gateway reservations must be paid through the linked QR or admin override.",
        },
        { status: 409 }
      );
    }

    const reference = `cash-${crypto.randomUUID()}`;
    const { data, error } = await supabase
      .from("folio_items")
      .insert({
        reservation_id: id,
        description: "Payment - Cash",
        amount: -roundMoney(payload.amount),
        payment_method: "Cash",
        external_source: "cash_payment",
        external_reference: reference,
        external_metadata: { actorUserId: profile.userId },
        received_by: profile.userId,
        received_at: new Date().toISOString(),
      })
      .select(
        "id, reservation_id, description, amount, timestamp, payment_method, transaction_id, external_source, external_reference, external_metadata, received_by, received_at"
      )
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return noStoreJson({ folioItem: mapCashFolio(data as unknown as DbCashFolioItem) }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

function mapCashFolio(row: DbCashFolioItem) {
  return {
    id: row.id,
    reservationId: row.reservation_id,
    description: row.description,
    amount: readMoney(row.amount),
    timestamp: row.timestamp,
    paymentMethod: row.payment_method,
    transactionId: row.transaction_id,
    externalSource: row.external_source,
    externalReference: row.external_reference,
    externalMetadata: row.external_metadata,
    receivedBy: row.received_by,
    receivedAt: row.received_at,
  };
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function readMoney(value: number | string): number {
  if (typeof value === "number") {
    return value;
  }

  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function handleApiError(error: unknown): NextResponse {
  if (error instanceof HttpError) {
    return noStoreJson({ message: error.message }, { status: error.status });
  }

  if (error instanceof z.ZodError) {
    return noStoreJson(
      { message: "Invalid cash payment.", issues: error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  if (error instanceof Error && error.message.trim()) {
    return noStoreJson({ message: error.message }, { status: 500 });
  }

  return noStoreJson({ message: "Unable to record cash payment." }, { status: 500 });
}

function noStoreJson(body: unknown, init: ResponseInit = {}): NextResponse {
  const headers = new Headers(init.headers);
  headers.set("Cache-Control", "private, no-store");

  return NextResponse.json(body, {
    ...init,
    headers,
  });
}

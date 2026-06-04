import { NextResponse } from "next/server";
import { z } from "zod";

import { createServerSupabaseClient } from "@/integrations/supabase/server";
import { HttpError, requirePermission } from "@/lib/server/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Body sent when applying a guest's credit note to this reservation.
const RedeemCreditNoteSchema = z.object({
  creditNoteId: z.string().trim().min(1),
  amount: z.coerce.number().positive(),
});

type DbCreditFolioItem = {
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

// POST /api/admin/reservations/[id]/redeem-credit-note
// Apply a credit note to this reservation. The database function does the
// balance check, the atomic decrement, and the folio insert in one transaction.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const profile = await requirePermission(request, "update:reservation");
    const { id } = await params;
    const payload = RedeemCreditNoteSchema.parse(await request.json());
    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase.rpc(
      "redeem_credit_note_with_balance_guard",
      {
        p_credit_note_id: payload.creditNoteId,
        p_reservation_id: id,
        p_amount: roundMoney(payload.amount),
        p_actor_user_id: profile.userId,
      }
    );

    if (error) {
      return handleRedeemError(error);
    }

    return noStoreJson(
      { folioItem: mapCreditFolio(data as unknown as DbCreditFolioItem) },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error);
  }
}

function mapCreditFolio(row: DbCreditFolioItem) {
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
      { message: "Invalid credit note redemption.", issues: error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  if (error instanceof Error && error.message.trim()) {
    return noStoreJson({ message: error.message }, { status: 500 });
  }

  return noStoreJson({ message: "Unable to redeem credit note." }, { status: 500 });
}

function handleRedeemError(error: unknown): NextResponse {
  const message = readErrorMessage(error) ?? "Unable to redeem credit note.";

  if (message === "Reservation not found." || message === "Credit note not found.") {
    return noStoreJson({ message }, { status: 404 });
  }

  if (
    message === "This reservation is already fully paid." ||
    message === "Amount exceeds the outstanding balance." ||
    message === "Insufficient credit note balance." ||
    message === "Credit note belongs to a different guest."
  ) {
    return noStoreJson({ message }, { status: 409 });
  }

  return noStoreJson({ message }, { status: 500 });
}

function readErrorMessage(error: unknown): string | null {
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string" &&
    error.message.trim()
  ) {
    return error.message;
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return null;
}

function noStoreJson(body: unknown, init: ResponseInit = {}): NextResponse {
  const headers = new Headers(init.headers);
  headers.set("Cache-Control", "private, no-store");

  return NextResponse.json(body, {
    ...init,
    headers,
  });
}

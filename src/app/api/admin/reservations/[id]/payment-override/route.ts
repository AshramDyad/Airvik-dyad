import { NextResponse } from "next/server";
import { z } from "zod";

import { createServerSupabaseClient } from "@/integrations/supabase/server";
import { HttpError, requirePermission } from "@/lib/server/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PaymentOverrideSchema = z.object({
  amount: z.coerce.number().positive(),
  reference: z.string().max(120).optional().nullable(),
  reason: z.string().trim().min(3).max(500),
});

type DbOverrideFolioItem = {
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
    const profile = await requirePermission(request, "update:payment");
    const { id } = await params;
    const payload = PaymentOverrideSchema.parse(await request.json());
    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase.rpc(
      "admin_confirm_gateway_payment_override",
      {
        p_reservation_id: id,
        p_paid_amount: roundMoney(payload.amount),
        p_payment_reference: payload.reference?.trim() || null,
        p_reason: payload.reason,
        p_actor_user_id: profile.userId,
      }
    );

    if (error) {
      throw new Error(error.message);
    }

    return noStoreJson(
      { folioItem: mapOverrideFolio(data as unknown as DbOverrideFolioItem) },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error);
  }
}

function mapOverrideFolio(row: DbOverrideFolioItem) {
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
      { message: "Invalid payment override.", issues: error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  if (error instanceof Error && error.message.trim()) {
    return noStoreJson({ message: error.message }, { status: 500 });
  }

  return noStoreJson(
    { message: "Unable to confirm payment override." },
    { status: 500 }
  );
}

function noStoreJson(body: unknown, init: ResponseInit = {}): NextResponse {
  const headers = new Headers(init.headers);
  headers.set("Cache-Control", "private, no-store");

  return NextResponse.json(body, {
    ...init,
    headers,
  });
}

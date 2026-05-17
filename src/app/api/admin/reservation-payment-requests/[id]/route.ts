import { NextResponse } from "next/server";
import { z } from "zod";

import { createServerSupabaseClient } from "@/integrations/supabase/server";
import { HttpError, requirePermission } from "@/lib/server/auth";

const STATUS_VALUES = [
  "requested",
  "partially_paid",
  "paid",
  "expired",
  "cancelled",
] as const;

const updateSchema = z.object({
  paidAmount: z.number().nonnegative("Paid amount cannot be negative.").optional(),
  status: z.enum(STATUS_VALUES).optional(),
  paidAt: z.string().nullable().optional(),
  paymentReference: z.string().trim().optional(),
  notes: z.string().trim().max(500, "Notes must be 500 characters or fewer").optional(),
  expiresAt: z.string().nullable().optional(),
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

type DbReservationPaymentRequestInsert = {
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

const mapRow = (row: DbReservationPaymentRequest) => ({
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
  externalMetadata: row.external_metadata ?? undefined,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const normalizeAmount = (value: number) => Math.round(value * 100) / 100;

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requirePermission(request, "update:reservation");
    const body = await request.json();
    const payload = updateSchema.parse(body);
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ message: "Missing request id." }, { status: 400 });
    }

    const supabase = createServerSupabaseClient();
    const { data: current, error: fetchError } = await supabase
      .from("reservation_payment_requests")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (fetchError) {
      console.error("Failed to load reservation payment request", fetchError);
      return NextResponse.json(
        { message: "Unable to load reservation payment request." },
        { status: 500 }
      );
    }

    if (!current) {
      return NextResponse.json({ message: "Reservation payment request not found." }, { status: 404 });
    }

    const currentRequest = current as DbReservationPaymentRequest;
    const requestedAmount = Number(currentRequest.amount);
    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (typeof payload.paidAmount === "number") {
      const paidAmount = normalizeAmount(payload.paidAmount);
      if (paidAmount > requestedAmount) {
        return NextResponse.json(
          { message: "Paid amount cannot exceed requested amount." },
          { status: 400 }
        );
      }
      updates.paid_amount = paidAmount;

      const statusFromAmount =
        paidAmount === 0
          ? "requested"
          : paidAmount >= requestedAmount
            ? "paid"
            : "partially_paid";
      if (!payload.status) {
        updates.status = statusFromAmount;
      }

      if (statusFromAmount === "paid" && !updates.paid_at) {
        updates.paid_at = payload.paidAt ?? (typeof currentRequest.paid_at === "string" ? currentRequest.paid_at : new Date().toISOString());
      }
    }

    if (typeof payload.status !== "undefined") {
      updates.status = payload.status;
      updates.paid_at = payload.status === "paid"
        ? payload.paidAt ?? new Date().toISOString()
        : null;
    }

    if (payload.paidAt !== undefined) {
      updates.paid_at = payload.paidAt;
    }

    if (typeof payload.paymentReference !== "undefined") {
      updates.payment_reference = payload.paymentReference || null;
    }

    if (typeof payload.notes !== "undefined") {
      updates.notes = payload.notes || null;
    }

    if (typeof payload.expiresAt !== "undefined") {
      updates.expires_at = payload.expiresAt;
    }

    if (Object.keys(updates).length === 1) {
      return NextResponse.json({ message: "Nothing to update." }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("reservation_payment_requests")
      .update(updates)
      .eq("id", id)
      .select("*")
      .maybeSingle();

    if (error) {
      console.error("Failed to update reservation payment request", error);
      return NextResponse.json(
        { message: "Unable to update reservation payment request." },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json({ message: "Reservation payment request not found." }, { status: 404 });
    }

    return NextResponse.json({ data: mapRow(data) });
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
    console.error("Unexpected reservation payment request update error", error);
    return NextResponse.json(
      { message: "Unexpected error while updating reservation payment request." },
      { status: 500 }
    );
  }
}

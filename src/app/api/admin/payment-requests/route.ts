import { NextResponse, type NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Permission } from "@/data/types";
import { createServerSupabaseClient } from "@/integrations/supabase/server";
import { HttpError, requireFeature, requirePermissions } from "@/lib/server/auth";
import {
  createPaymentRequest,
  listPaymentRequests,
  reconcilePaymentRequests,
} from "@/lib/payments/payment-requests-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DbReservationPaymentMethod = {
  id: string;
  payment_method: string | null;
};

export async function GET(request: NextRequest) {
  try {
    const reservationId = readOptionalUuid(
      request.nextUrl.searchParams.get("reservationId"),
      "reservationId"
    );
    const shouldSync = request.nextUrl.searchParams.get("sync") === "1";

    if (reservationId && shouldSync) {
      const profile = await requirePermissions(
        request,
        "read:payment",
        "create:reservation",
        "update:reservation"
      );
      requireAllPermissions(profile.permissions, [
        "read:payment",
        "create:reservation",
        "update:reservation",
      ]);
    } else {
      await requireFeature(request, reservationId ? ["payments", "reservations"] : "payments");
    }

    const supabase = createServerSupabaseClient();
    let syncMessage: string | undefined;

    if (shouldSync) {
      try {
        await reconcilePaymentRequests(supabase, { reservationId });
      } catch (syncError) {
        syncMessage =
          syncError instanceof Error
            ? syncError.message
            : "Unable to sync payment requests.";
      }
    }

    const requests = await listPaymentRequests(supabase, { reservationId });
    return noStoreJson({
      requests,
      ...(syncMessage ? { message: syncMessage } : {}),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: unknown = await request.json();
    const amount = readAmount(body);
    const reservationId = readOptionalBodyUuid(body, "reservationId");
    const profile = reservationId
      ? await requirePermissions(
          request,
          "read:payment",
          "create:reservation",
          "update:reservation"
        )
      : await requireFeature(request, "payments");
    if (reservationId) {
      requireAllPermissions(profile.permissions, [
        "read:payment",
        "create:reservation",
        "update:reservation",
      ]);
    }

    const supabase = createServerSupabaseClient();
    if (reservationId) {
      await assertGatewayReservation(supabase, reservationId);
    }

    const paymentRequest = await createPaymentRequest({
      supabase,
      amount,
      createdBy: profile.userId,
      reservationId,
    });

    return noStoreJson({ request: paymentRequest }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

function requireAllPermissions(
  permissions: Permission[],
  requiredPermissions: Permission[]
): void {
  const isAllowed = requiredPermissions.every((permission) =>
    permissions.includes(permission)
  );

  if (!isAllowed) {
    throw new HttpError(403, "Insufficient permissions");
  }
}

async function assertGatewayReservation(
  supabase: SupabaseClient,
  reservationId: string
): Promise<void> {
  const { data, error } = await supabase
    .from("reservations")
    .select("id, payment_method")
    .eq("id", reservationId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new HttpError(404, "Reservation not found.");
  }

  const reservation = data as unknown as DbReservationPaymentMethod;
  if (reservation.payment_method !== "UPI Gateway") {
    throw new HttpError(
      409,
      "Payment QR can be generated only for UPI Gateway reservations."
    );
  }
}

function readOptionalBodyUuid(
  body: unknown,
  key: string
): string | null {
  if (!isRecord(body)) {
    return null;
  }

  const value = body[key];
  return typeof value === "string" ? readOptionalUuid(value, key) : null;
}

function readOptionalUuid(value: string | null, fieldName: string): string | null {
  if (!value || !value.trim()) {
    return null;
  }

  const trimmed = value.trim();
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed)
  ) {
    throw new HttpError(400, `${fieldName} must be a valid UUID.`);
  }

  return trimmed;
}

function readAmount(body: unknown): number {
  if (!isRecord(body)) {
    throw new HttpError(400, "Amount is required.");
  }

  const rawAmount = body.amount;
  const amount =
    typeof rawAmount === "number"
      ? rawAmount
      : typeof rawAmount === "string"
        ? Number.parseFloat(rawAmount)
        : Number.NaN;

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new HttpError(400, "Enter a valid payment amount.");
  }

  return Math.round(amount * 100) / 100;
}

function handleApiError(error: unknown): NextResponse {
  if (error instanceof HttpError) {
    return noStoreJson({ message: error.message }, { status: error.status });
  }

  if (error instanceof Error && error.message.trim()) {
    return noStoreJson({ message: error.message }, { status: 500 });
  }

  return noStoreJson(
    { message: "Unable to process payment request." },
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

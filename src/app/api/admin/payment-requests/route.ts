import { NextResponse, type NextRequest } from "next/server";

import { createServerSupabaseClient } from "@/integrations/supabase/server";
import { HttpError, requireFeature } from "@/lib/server/auth";
import {
  createPaymentRequest,
  listPaymentRequests,
  reconcilePaymentRequests,
} from "@/lib/payments/payment-requests-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    await requireFeature(request, "payments");
    const supabase = createServerSupabaseClient();
    const shouldSync = request.nextUrl.searchParams.get("sync") === "1";
    let syncMessage: string | undefined;

    if (shouldSync) {
      try {
        await reconcilePaymentRequests(supabase);
      } catch (syncError) {
        syncMessage =
          syncError instanceof Error
            ? syncError.message
            : "Unable to sync payment requests.";
      }
    }

    const requests = await listPaymentRequests(supabase);
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
    const profile = await requireFeature(request, "payments");
    const body: unknown = await request.json();
    const amount = readAmount(body);
    const supabase = createServerSupabaseClient();
    const paymentRequest = await createPaymentRequest({
      supabase,
      amount,
      createdBy: profile.userId,
    });

    return noStoreJson({ request: paymentRequest }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
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

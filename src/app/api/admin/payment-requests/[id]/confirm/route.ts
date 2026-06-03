import { NextResponse } from "next/server";

import { createServerSupabaseClient } from "@/integrations/supabase/server";
import { markPaymentRequestPaidManually } from "@/lib/payments/payment-requests-server";
import { HttpError, requirePermission } from "@/lib/server/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePermission(request, "update:payment");
    const { id } = await params;

    if (!UUID_PATTERN.test(id.trim())) {
      throw new HttpError(400, "Payment request id must be a valid UUID.");
    }

    const supabase = createServerSupabaseClient();
    const paymentRequest = await markPaymentRequestPaidManually({
      supabase,
      paymentRequestId: id.trim(),
    });

    return noStoreJson({ request: paymentRequest }, { status: 200 });
  } catch (error) {
    return handleApiError(error);
  }
}

function handleApiError(error: unknown): NextResponse {
  if (error instanceof HttpError) {
    return noStoreJson({ message: error.message }, { status: error.status });
  }

  if (error instanceof Error && error.message.trim()) {
    return noStoreJson({ message: error.message }, { status: 500 });
  }

  return noStoreJson(
    { message: "Unable to confirm payment." },
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

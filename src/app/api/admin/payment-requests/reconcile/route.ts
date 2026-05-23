import { NextResponse, type NextRequest } from "next/server";

import { createServerSupabaseClient } from "@/integrations/supabase/server";
import { reconcilePaymentRequests } from "@/lib/payments/payment-requests-server";
import { HttpError, requireFeature } from "@/lib/server/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    await requireFeature(request, "payments");
    const supabase = createServerSupabaseClient();
    const result = await reconcilePaymentRequests(supabase);
    return noStoreJson(result);
  } catch (error) {
    if (error instanceof HttpError) {
      return noStoreJson({ message: error.message }, { status: error.status });
    }

    if (error instanceof Error && error.message.trim()) {
      return noStoreJson({ message: error.message }, { status: 500 });
    }

    return noStoreJson({ message: "Unable to reconcile payments." }, { status: 500 });
  }
}

function noStoreJson(body: unknown, init: ResponseInit = {}): NextResponse {
  const headers = new Headers(init.headers);
  headers.set("Cache-Control", "private, no-store");

  return NextResponse.json(body, {
    ...init,
    headers,
  });
}

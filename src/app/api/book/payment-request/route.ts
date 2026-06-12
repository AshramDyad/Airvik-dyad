import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { createServerSupabaseClient } from "@/integrations/supabase/server";
import { getOrCreateWebsitePaymentRequest } from "@/lib/payments/website-payment-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PayloadSchema = z.object({
  reservationId: z.string().uuid("A valid reservation id is required."),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { reservationId } = PayloadSchema.parse(body);

    const supabase = createServerSupabaseClient();
    const result = await getOrCreateWebsitePaymentRequest(
      supabase,
      reservationId
    );

    if (!result) {
      return noStoreJson(
        { message: "We couldn't find that booking." },
        { status: 404 }
      );
    }

    return noStoreJson(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return noStoreJson(
        { message: "Invalid request.", issues: error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    console.error("Failed to prepare website payment request", error);
    return noStoreJson(
      { message: "Unable to start the payment right now." },
      { status: 500 }
    );
  }
}

function noStoreJson(body: unknown, init: ResponseInit = {}): NextResponse {
  const headers = new Headers(init.headers);
  headers.set("Cache-Control", "private, no-store");

  return NextResponse.json(body, { ...init, headers });
}

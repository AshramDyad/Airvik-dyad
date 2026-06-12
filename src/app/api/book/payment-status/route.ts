import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { createServerSupabaseClient } from "@/integrations/supabase/server";
import { getWebsitePaymentStatus } from "@/lib/payments/website-payment-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const QuerySchema = z.object({
  reservationId: z.string().uuid("A valid reservation id is required."),
});

export async function GET(request: NextRequest) {
  try {
    const { reservationId } = QuerySchema.parse({
      reservationId: request.nextUrl.searchParams.get("reservationId"),
    });

    const supabase = createServerSupabaseClient();
    const status = await getWebsitePaymentStatus(supabase, reservationId);

    if (!status) {
      return noStoreJson(
        { message: "We couldn't find that booking." },
        { status: 404 }
      );
    }

    return noStoreJson(status);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return noStoreJson(
        { message: "Invalid request.", issues: error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    console.error("Failed to read website payment status", error);
    return noStoreJson(
      { message: "Unable to check the payment right now." },
      { status: 500 }
    );
  }
}

function noStoreJson(body: unknown, init: ResponseInit = {}): NextResponse {
  const headers = new Headers(init.headers);
  headers.set("Cache-Control", "private, no-store");

  return NextResponse.json(body, { ...init, headers });
}

import { NextResponse } from "next/server";
import { z } from "zod";

import { createServerSupabaseClient } from "@/integrations/supabase/server";
import { attachStatementPaymentToBooking } from "@/lib/payments/statement-links-server";
import { HttpError, requirePermission } from "@/lib/server/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const AttachSchema = z.object({
  bookingId: z.string().trim().min(1),
  amount: z.coerce.number().positive(),
  reference: z.string().trim().min(1),
});

export async function POST(request: Request) {
  try {
    const profile = await requirePermission(request, "update:payment");
    const payload = AttachSchema.parse(await request.json());
    const supabase = createServerSupabaseClient();

    const { reservationId } = await attachStatementPaymentToBooking({
      supabase,
      bookingId: payload.bookingId,
      amount: payload.amount,
      reference: payload.reference,
      actorUserId: profile.userId,
    });

    return noStoreJson({ reservationId }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

function handleApiError(error: unknown): NextResponse {
  if (error instanceof HttpError) {
    return noStoreJson({ message: error.message }, { status: error.status });
  }

  if (error instanceof z.ZodError) {
    return noStoreJson(
      { message: "Invalid attach request.", issues: error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  if (error instanceof Error && error.message.trim()) {
    return noStoreJson({ message: error.message }, { status: 500 });
  }

  return noStoreJson(
    { message: "Unable to attach payment." },
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

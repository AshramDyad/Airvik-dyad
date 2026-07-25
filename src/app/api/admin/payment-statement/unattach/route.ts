import { NextResponse } from "next/server";
import { z } from "zod";

import { ROLE_NAMES } from "@/constants/roles";
import { createServerSupabaseClient } from "@/integrations/supabase/server";
import { logAdminActivityFromProfile } from "@/lib/activity/server";
import { unattachStatementPayment } from "@/lib/payments/statement-links-server";
import { HttpError, requirePermission } from "@/lib/server/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UnattachSchema = z.object({
  folioItemId: z.string().uuid(),
});

export async function POST(request: Request) {
  try {
    // update:payment is held by several desk roles, so narrow it further: removing a
    // recorded payment is an admin-only correction.
    const profile = await requirePermission(request, "update:payment");
    if (profile.roleName !== ROLE_NAMES.ADMINISTRATION) {
      throw new HttpError(403, "Only Administration can unattach a payment.");
    }

    const payload = UnattachSchema.parse(await request.json());
    const supabase = createServerSupabaseClient();

    const result = await unattachStatementPayment({
      supabase,
      folioItemId: payload.folioItemId,
    });

    // The payment row is deleted, so keep a trace of who removed it and from where.
    try {
      await logAdminActivityFromProfile({
        profile,
        entry: {
          section: "reservations",
          entityType: "reservation",
          entityId: result.reservationId,
          entityLabel: result.bookingId,
          action: "unattach_payment",
          details: `Unattached a UPI Gateway payment from booking ${
            result.bookingId ?? "unknown"
          }`,
          amountMinor: Math.round(Math.abs(result.amount) * 100),
          metadata: {
            folioItemId: payload.folioItemId,
            statusReverted: result.statusReverted,
          },
        },
      });
    } catch (logError) {
      // Losing the audit line must not fail a correction the admin already made.
      console.warn("Failed to log payment unattach:", logError);
    }

    return noStoreJson({ ok: true, statusReverted: result.statusReverted });
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
      { message: "Invalid unattach request.", issues: error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  if (error instanceof Error && error.message.trim()) {
    return noStoreJson({ message: error.message }, { status: 500 });
  }

  return noStoreJson({ message: "Unable to unattach payment." }, { status: 500 });
}

function noStoreJson(body: unknown, init: ResponseInit = {}): NextResponse {
  const headers = new Headers(init.headers);
  headers.set("Cache-Control", "private, no-store");

  return NextResponse.json(body, {
    ...init,
    headers,
  });
}

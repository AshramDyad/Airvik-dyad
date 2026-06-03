import { NextResponse } from "next/server";

import { createServerSupabaseClient } from "@/integrations/supabase/server";
import { getStatementBookingLinks } from "@/lib/payments/statement-links-server";
import { HttpError, requireFeature } from "@/lib/server/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    // Same gate as the statement transactions route, so the booking column loads
    // for exactly the users who can see the statement.
    await requireFeature(request, "payments");
    const supabase = createServerSupabaseClient();
    const links = await getStatementBookingLinks({ supabase });
    return noStoreJson({ links }, { status: 200 });
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
    { message: "Unable to load booking links." },
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

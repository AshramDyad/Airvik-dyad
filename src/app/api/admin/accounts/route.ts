import { NextResponse } from "next/server";

import { createServerSupabaseClient } from "@/integrations/supabase/server";
import { getDailyPaymentAccounting } from "@/lib/payments/accounting-server";
import { HttpError, requireFeature } from "@/lib/server/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requireFeature(request, "payments");
    const url = new URL(request.url);
    const date = readDate(url.searchParams.get("date"));
    const timeZone = url.searchParams.get("timeZone") || "Asia/Kolkata";
    const supabase = createServerSupabaseClient();
    const accounting = await getDailyPaymentAccounting({
      supabase,
      date,
      timeZone,
    });

    return noStoreJson(accounting);
  } catch (error) {
    return handleApiError(error);
  }
}

function readDate(value: string | null): string {
  if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function handleApiError(error: unknown): NextResponse {
  if (error instanceof HttpError) {
    return noStoreJson({ message: error.message }, { status: error.status });
  }

  if (error instanceof Error && error.message.trim()) {
    return noStoreJson({ message: error.message }, { status: 500 });
  }

  return noStoreJson({ message: "Unable to load accounts." }, { status: 500 });
}

function noStoreJson(body: unknown, init: ResponseInit = {}): NextResponse {
  const headers = new Headers(init.headers);
  headers.set("Cache-Control", "private, no-store");

  return NextResponse.json(body, {
    ...init,
    headers,
  });
}

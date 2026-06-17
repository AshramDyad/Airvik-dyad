import { NextResponse } from "next/server";
import { z } from "zod";
import { createHash, timingSafeEqual } from "node:crypto";

import { createServerSupabaseClient } from "@/integrations/supabase/server";
import { HttpError, requirePermissions } from "@/lib/server/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VerifySchema = z.object({
  otpId: z.string().uuid(),
  code: z.string().regex(/^\d{6}$/),
});

const MAX_ATTEMPTS = 5;

type OtpRow = {
  id: string;
  code_hash: string;
  attempts: number;
  consumed_at: string | null;
  expires_at: string;
};

export async function POST(request: Request) {
  try {
    await requirePermissions(request, "create:reservation");

    const { otpId, code } = VerifySchema.parse(await request.json());
    const supabase = createServerSupabaseClient();

    const { data } = await supabase
      .from("reservation_otp_codes")
      .select("id, code_hash, attempts, consumed_at, expires_at")
      .eq("id", otpId)
      .maybeSingle();
    const row = data as OtpRow | null;

    // A wrong/expired/used code is a 200 with { verified: false } on purpose — the
    // client calls this through authorizedFetch, which treats 401/429 as session
    // problems (token refresh / retry). Reserve non-2xx for genuine auth failures.
    if (!row) return noStoreJson({ verified: false, reason: "not_found" });
    if (row.consumed_at) return noStoreJson({ verified: false, reason: "used" });
    if (new Date(row.expires_at).getTime() < Date.now()) {
      return noStoreJson({ verified: false, reason: "expired" });
    }
    if (row.attempts >= MAX_ATTEMPTS) {
      return noStoreJson({ verified: false, reason: "locked" });
    }

    const codeHash = createHash("sha256").update(code).digest("hex");
    if (!hashesEqual(codeHash, row.code_hash)) {
      await supabase
        .from("reservation_otp_codes")
        .update({ attempts: row.attempts + 1 })
        .eq("id", otpId);
      return noStoreJson({ verified: false, reason: "mismatch" });
    }

    await supabase
      .from("reservation_otp_codes")
      .update({ consumed_at: new Date().toISOString() })
      .eq("id", otpId);

    return noStoreJson({ verified: true });
  } catch (error) {
    return handleApiError(error);
  }
}

function hashesEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "hex");
  const bufB = Buffer.from(b, "hex");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

function handleApiError(error: unknown): NextResponse {
  if (error instanceof HttpError) {
    return noStoreJson({ message: error.message }, { status: error.status });
  }
  if (error instanceof z.ZodError) {
    return noStoreJson(
      { message: "Invalid verification request.", issues: error.flatten().fieldErrors },
      { status: 400 }
    );
  }
  if (error instanceof Error && error.message.trim()) {
    return noStoreJson({ message: error.message }, { status: 500 });
  }
  return noStoreJson({ message: "Unable to verify OTP." }, { status: 500 });
}

function noStoreJson(body: unknown, init: ResponseInit = {}): NextResponse {
  const headers = new Headers(init.headers);
  headers.set("Cache-Control", "private, no-store");
  return NextResponse.json(body, { ...init, headers });
}

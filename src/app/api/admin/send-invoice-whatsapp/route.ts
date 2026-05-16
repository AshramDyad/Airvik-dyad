import { NextResponse } from "next/server";

import { HttpError, requireFeature } from "@/lib/server/auth";
import { sendWhatsAppFile } from "@/lib/whatsapp";

const cacheHeaders = {
  "Cache-Control": "private, no-store",
};

const noStoreJson = (body: unknown, init?: ResponseInit) =>
  NextResponse.json(body, { ...init, headers: cacheHeaders });

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  // 10-digit Indian number → prepend 91
  if (digits.length === 10) {
    return `91${digits}`;
  }
  return digits;
}

export async function POST(request: Request) {
  try {
    await requireFeature(request, ["reservations", "donations"]);
  } catch (error) {
    if (error instanceof HttpError) {
      return noStoreJson({ message: error.message }, { status: error.status });
    }
    return noStoreJson({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const phone = formData.get("phone");
    const file = formData.get("file");

    if (!phone || typeof phone !== "string") {
      return noStoreJson({ message: "Phone number is required" }, { status: 400 });
    }

    if (!file || !(file instanceof File)) {
      return noStoreJson({ message: "File is required" }, { status: 400 });
    }

    const normalizedPhone = normalizePhone(phone);
    if (!normalizedPhone) {
      return noStoreJson({ message: "Invalid phone number" }, { status: 400 });
    }

    const result = await sendWhatsAppFile(
      normalizedPhone,
      file,
      "Here is your Swaminarayan Ashram Receipt. Thank you!",
    );

    if (!result.success) {
      return noStoreJson({ message: result.error }, { status: 502 });
    }

    return new Response(null, { status: 204, headers: cacheHeaders });
  } catch (error) {
    console.error("[send-invoice-whatsapp] Error:", error);
    return noStoreJson({ message: "Internal server error" }, { status: 500 });
  }
}

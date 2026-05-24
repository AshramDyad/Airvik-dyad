import { NextResponse } from "next/server";

import { HttpError, requireFeature } from "@/lib/server/auth";
import { sendWhatsAppImage } from "@/lib/whatsapp";

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) {
    return `91${digits}`;
  }
  return digits;
}

export async function POST(request: Request) {
  try {
    await requireFeature(request, ["reservations", "payments"]);
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const phone = formData.get("phone");
    const image = formData.get("image");
    const caption = formData.get("caption");

    if (!phone || typeof phone !== "string") {
      return NextResponse.json({ message: "Phone number is required" }, { status: 400 });
    }

    if (!image || !(image instanceof File)) {
      return NextResponse.json({ message: "QR image is required" }, { status: 400 });
    }

    const normalizedPhone = normalizePhone(phone);
    if (!normalizedPhone) {
      return NextResponse.json({ message: "Invalid phone number" }, { status: 400 });
    }

    const result = await sendWhatsAppImage(
      normalizedPhone,
      image,
      typeof caption === "string" && caption.trim()
        ? caption.trim()
        : "Payment QR for your Swaminarayan Ashram reservation."
    );

    if (!result.success) {
      return NextResponse.json({ message: result.error }, { status: 502 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[send-payment-qr-whatsapp] Error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

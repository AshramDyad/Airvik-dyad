import { NextRequest, NextResponse } from "next/server";
import { getDonationById, updateDonationRecord } from "@/lib/api/donations";
import { verifyCheckoutSignature } from "@/lib/razorpay";

const cacheHeaders = {
  "Cache-Control": "private, no-store",
};
const noStoreJson = (body: unknown, init?: ResponseInit) =>
  NextResponse.json(body, { ...init, headers: cacheHeaders });

export async function POST(request: NextRequest) {
  try {
    const { donationId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = await request.json();

    if (!donationId || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return noStoreJson({ message: "Missing payment verification payload" }, { status: 400 });
    }

    const donation = await getDonationById(donationId);
    if (!donation) {
      return noStoreJson({ message: "Donation not found" }, { status: 404 });
    }

    const isValid = verifyCheckoutSignature({
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      signature: razorpay_signature,
    });

    if (!isValid) {
      return noStoreJson({ message: "Signature verification failed" }, { status: 400 });
    }

    const updated = await updateDonationRecord(donation.id, {
      paymentStatus: "paid",
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      razorpaySignature: razorpay_signature,
    });

    return noStoreJson({
      receipt: {
        donationId: updated.id,
        amountInMinor: updated.amountInMinor,
        currency: updated.currency,
        frequency: updated.frequency,
        email: updated.email,
        message: updated.message,
        paymentId: updated.razorpayPaymentId,
        timestamp: updated.updatedAt,
      },
    });
  } catch (error) {
    console.error("Failed to verify Razorpay payment", error);
    return noStoreJson(
      { message: error instanceof Error ? error.message : "Unable to verify payment" },
      { status: 400 },
    );
  }
}

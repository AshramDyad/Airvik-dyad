import { NextRequest, NextResponse } from "next/server";
import {
  getDonationIdByOrderId,
  updateDonationRecordWithoutReturning,
} from "@/lib/api/donations";
import { verifyWebhookSignature } from "@/lib/razorpay";

const cacheHeaders = {
  "Cache-Control": "private, no-store",
};
const noStoreJson = (body: unknown, init?: ResponseInit) =>
  NextResponse.json(body, { ...init, headers: cacheHeaders });

export async function POST(request: NextRequest) {
  const signature = request.headers.get("x-razorpay-signature");
  const payload = await request.text();

  if (!signature) {
    return noStoreJson({ message: "Missing webhook signature" }, { status: 400 });
  }

  try {
    const isValid = verifyWebhookSignature(payload, signature);
    if (!isValid) {
      return noStoreJson({ message: "Invalid webhook signature" }, { status: 400 });
    }

    const event = JSON.parse(payload);
    const payment = event?.payload?.payment?.entity;
    const orderId = payment?.order_id;
    const paymentId = payment?.id;
    const status = payment?.status;

    if (!orderId) {
      return noStoreJson({ received: true });
    }

    const donationId = await getDonationIdByOrderId(orderId);
    if (!donationId) {
      return noStoreJson({ received: true });
    }

    const updates: Parameters<typeof updateDonationRecordWithoutReturning>[1] = {
      razorpayPaymentId: paymentId ?? undefined,
    };

    if (status === "captured" || status === "authorized") {
      updates.paymentStatus = "paid";
    } else if (status === "failed") {
      updates.paymentStatus = "failed";
    } else if (status === "refunded") {
      updates.paymentStatus = "refunded";
    }

    await updateDonationRecordWithoutReturning(donationId, updates);

    return noStoreJson({ received: true });
  } catch (error) {
    console.error("Razorpay webhook error", error);
    return noStoreJson({ message: "Webhook handler failed" }, { status: 400 });
  }
}

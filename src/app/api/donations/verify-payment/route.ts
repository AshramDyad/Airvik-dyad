import { NextRequest, NextResponse } from "next/server";
import { getDonationById, updateDonationRecord } from "@/lib/api/donations";
import { verifyCheckoutSignature } from "@/lib/razorpay";

export async function POST(request: NextRequest) {
  try {
    const { donationId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = await request.json();

    if (!donationId || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return NextResponse.json({ message: "Missing payment verification payload" }, { status: 400 });
    }

    const donation = await getDonationById(donationId);
    if (!donation) {
      return NextResponse.json({ message: "Donation not found" }, { status: 404 });
    }

    // Bind the verified order to THIS donation. A valid signature only proves the
    // (order, payment) pair is genuine on our Razorpay account — without this check
    // a valid triple from any other order could be replayed to mark an unrelated
    // (larger) donation as paid. See audit finding H2.
    if (!donation.razorpayOrderId || donation.razorpayOrderId !== razorpay_order_id) {
      return NextResponse.json(
        { message: "Payment does not match this donation." },
        { status: 400 },
      );
    }

    const isValid = verifyCheckoutSignature({
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      signature: razorpay_signature,
    });

    if (!isValid) {
      return NextResponse.json({ message: "Signature verification failed" }, { status: 400 });
    }

    const updated = await updateDonationRecord(donation.id, {
      paymentStatus: "paid",
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      razorpaySignature: razorpay_signature,
    });

    return NextResponse.json({
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
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Unable to verify payment" },
      { status: 400 },
    );
  }
}

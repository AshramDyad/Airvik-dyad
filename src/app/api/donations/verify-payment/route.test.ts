import { beforeEach, describe, expect, it, vi } from "vitest";

const donationMocks = vi.hoisted(() => ({
  getDonationById: vi.fn(),
  updateDonationRecord: vi.fn(),
  updateDonationRecordTimestampOnly: vi.fn(),
}));
const razorpayMocks = vi.hoisted(() => ({
  verifyCheckoutSignature: vi.fn(),
}));

vi.mock("@/lib/api/donations", () => donationMocks);
vi.mock("@/lib/razorpay", () => razorpayMocks);

import { POST } from "./route";

const donation = {
  id: "donation-1",
  donorName: "Asha Guest",
  email: "asha@example.com",
  phone: "9999999999",
  amountInMinor: 100000,
  currency: "INR",
  frequency: "one_time",
  message: "For meals",
  consent: true,
  paymentProvider: "razorpay",
  paymentStatus: "pending",
  metadata: {},
  createdAt: "2026-05-14T00:00:00.000Z",
  updatedAt: "2026-05-14T00:00:00.000Z",
};

describe("donation verify payment API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    donationMocks.getDonationById.mockResolvedValue(donation);
    donationMocks.updateDonationRecord.mockResolvedValue({
      ...donation,
      paymentStatus: "paid",
      razorpayOrderId: "order_1",
      razorpayPaymentId: "pay_1",
      razorpaySignature: "sig_1",
      updatedAt: "2026-05-14T01:00:00.000Z",
    });
    donationMocks.updateDonationRecordTimestampOnly.mockResolvedValue({
      updatedAt: "2026-05-14T01:00:00.000Z",
    });
    razorpayMocks.verifyCheckoutSignature.mockReturnValue(true);
  });

  it("verifies checkout signatures and returns a no-store receipt", async () => {
    const response = await POST(
      new Request("https://airvik.test/api/donations/verify-payment", {
        method: "POST",
        body: JSON.stringify({
          donationId: "donation-1",
          razorpay_order_id: "order_1",
          razorpay_payment_id: "pay_1",
          razorpay_signature: "sig_1",
        }),
      }) as never,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(razorpayMocks.verifyCheckoutSignature).toHaveBeenCalledWith({
      orderId: "order_1",
      paymentId: "pay_1",
      signature: "sig_1",
    });
    expect(donationMocks.updateDonationRecordTimestampOnly).toHaveBeenCalledWith(
      "donation-1",
      {
        paymentStatus: "paid",
        razorpayOrderId: "order_1",
        razorpayPaymentId: "pay_1",
        razorpaySignature: "sig_1",
      },
    );
    expect(donationMocks.updateDonationRecord).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual({
      receipt: {
        donationId: "donation-1",
        amountInMinor: 100000,
        currency: "INR",
        frequency: "one_time",
        email: "asha@example.com",
        message: "For meals",
        paymentId: "pay_1",
        timestamp: "2026-05-14T01:00:00.000Z",
      },
    });
  });
});

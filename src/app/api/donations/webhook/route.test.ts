import { beforeEach, describe, expect, it, vi } from "vitest";

const donationMocks = vi.hoisted(() => ({
  getDonationByOrderId: vi.fn(),
  getDonationIdByOrderId: vi.fn(),
  updateDonationRecord: vi.fn(),
  updateDonationRecordWithoutReturning: vi.fn(),
}));
const razorpayMocks = vi.hoisted(() => ({
  verifyWebhookSignature: vi.fn(),
}));

vi.mock("@/lib/api/donations", () => donationMocks);
vi.mock("@/lib/razorpay", () => razorpayMocks);

import { POST } from "./route";

describe("donation webhook API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    donationMocks.getDonationByOrderId.mockResolvedValue({ id: "donation-1" });
    donationMocks.getDonationIdByOrderId.mockResolvedValue("donation-1");
    donationMocks.updateDonationRecord.mockResolvedValue({ id: "donation-1" });
    donationMocks.updateDonationRecordWithoutReturning.mockResolvedValue(undefined);
    razorpayMocks.verifyWebhookSignature.mockReturnValue(true);
  });

  it("uses id-only lookup and no-return update for captured payments", async () => {
    const response = await POST(
      new Request("https://airvik.test/api/donations/webhook", {
        method: "POST",
        headers: { "x-razorpay-signature": "sig_1" },
        body: JSON.stringify({
          payload: {
            payment: {
              entity: {
                id: "pay_1",
                order_id: "order_1",
                status: "captured",
              },
            },
          },
        }),
      }) as never,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(donationMocks.getDonationIdByOrderId).toHaveBeenCalledWith("order_1");
    expect(donationMocks.getDonationByOrderId).not.toHaveBeenCalled();
    expect(donationMocks.updateDonationRecordWithoutReturning).toHaveBeenCalledWith(
      "donation-1",
      {
        razorpayPaymentId: "pay_1",
        paymentStatus: "paid",
      },
    );
    expect(donationMocks.updateDonationRecord).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual({ received: true });
  });
});

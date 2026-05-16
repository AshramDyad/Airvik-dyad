import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const donationMocks = vi.hoisted(() => ({
  createDonationRecord: vi.fn(),
  updateDonationRecord: vi.fn(),
  updateDonationRecordWithoutReturning: vi.fn(),
}));
const razorpayMocks = vi.hoisted(() => ({
  getRazorpayClient: vi.fn(),
  isRazorpayMockMode: vi.fn(),
}));

vi.mock("@/lib/api/donations", () => donationMocks);
vi.mock("@/lib/razorpay", () => razorpayMocks);

import { POST } from "./route";

const originalPublicKey = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;

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

describe("donation create order API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID = "rzp_test_public";
    donationMocks.createDonationRecord.mockResolvedValue(donation);
    donationMocks.updateDonationRecord.mockResolvedValue(donation);
    donationMocks.updateDonationRecordWithoutReturning.mockResolvedValue(undefined);
    razorpayMocks.isRazorpayMockMode.mockReturnValue(false);
  });

  afterEach(() => {
    if (typeof originalPublicKey === "undefined") {
      delete process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
    } else {
      process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID = originalPublicKey;
    }
  });

  it("returns only checkout order fields with private no-store headers", async () => {
    const createOrder = vi.fn(async () => ({
      id: "order_1",
      amount: 100000,
      amount_paid: 0,
      amount_due: 100000,
      attempts: 0,
      currency: "INR",
      entity: "order",
      notes: { donation_id: "donation-1" },
      receipt: "donation_donation-1",
      status: "created",
    }));
    razorpayMocks.getRazorpayClient.mockReturnValue({
      orders: { create: createOrder },
    });

    const response = await POST(
      new Request("https://airvik.test/api/donations/create-order", {
        method: "POST",
        body: JSON.stringify({
          donorName: "Asha Guest",
          email: "asha@example.com",
          phone: "9999999999",
          amount: 1000,
          currency: "INR",
          frequency: "one_time",
          message: "For meals",
          consent: true,
        }),
      }) as never,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    const payload = await response.json();
    expect(payload).toMatchObject({
      keyId: "rzp_test_public",
      order: {
        id: "order_1",
        amount: 100000,
        currency: "INR",
        status: "created",
      },
      donation: {
        id: "donation-1",
        donorName: "Asha Guest",
        email: "asha@example.com",
      },
    });
    expect(payload.order).not.toHaveProperty("amount_due");
    expect(payload.order).not.toHaveProperty("amount_paid");
    expect(payload.order).not.toHaveProperty("notes");
  });
});

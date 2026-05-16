import { beforeEach, describe, expect, it, vi } from "vitest";

const createServerSupabaseClientMock = vi.hoisted(() => vi.fn());

vi.mock("@/integrations/supabase/server", () => ({
  createServerSupabaseClient: createServerSupabaseClientMock,
}));

import {
  createDonationRecord,
  DONATION_SELECT_COLUMNS,
  DONATION_ID_SELECT_COLUMNS,
  DONATION_STATS_SELECT_COLUMNS,
  getDonationIdByOrderId,
  getDonationStats,
  updateDonationRecord,
  updateDonationRecordWithoutReturning,
} from "./donations";

const donationRow = {
  id: "donation-1",
  donor_name: "Asha",
  email: "asha@example.com",
  phone: "555",
  amount_in_minor: 10000,
  currency: "INR",
  frequency: "one_time",
  message: null,
  consent: true,
  payment_provider: "razorpay",
  payment_status: "paid",
  razorpay_order_id: "order_1",
  razorpay_payment_id: "pay_1",
  razorpay_signature: null,
  upi_reference: null,
  metadata: {},
  created_at: "2026-05-01T00:00:00.000Z",
  updated_at: "2026-05-01T00:00:00.000Z",
};

const createQuery = (response: unknown) => {
  const query = {
    insert: vi.fn(() => query),
    update: vi.fn(() => query),
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    single: vi.fn(async () => response),
    maybeSingle: vi.fn(async () => response),
  };
  return query;
};

describe("donation API data access", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("createDonationRecord returns only the mapped donation columns", async () => {
    const query = createQuery({ data: donationRow, error: null });
    createServerSupabaseClientMock.mockReturnValue({ from: vi.fn(() => query) });

    await createDonationRecord({
      donorName: "Asha",
      email: "asha@example.com",
      phone: "555",
      amountInMinor: 10000,
      currency: "INR",
      frequency: "one_time",
      consent: true,
      paymentProvider: "razorpay",
      paymentStatus: "paid",
    });

    expect(query.select).toHaveBeenCalledWith(DONATION_SELECT_COLUMNS);
    expect(query.single).toHaveBeenCalledTimes(1);
  });

  it("updateDonationRecord returns only the mapped donation columns", async () => {
    const query = createQuery({ data: donationRow, error: null });
    createServerSupabaseClientMock.mockReturnValue({ from: vi.fn(() => query) });

    await updateDonationRecord("donation-1", { paymentStatus: "paid" });

    expect(query.eq).toHaveBeenCalledWith("id", "donation-1");
    expect(query.select).toHaveBeenCalledWith(DONATION_SELECT_COLUMNS);
    expect(query.single).toHaveBeenCalledTimes(1);
  });

  it("updateDonationRecordWithoutReturning updates without selecting the row", async () => {
    const query = {
      update: vi.fn(() => query),
      eq: vi.fn(async () => ({ error: null })),
      select: vi.fn(() => query),
      single: vi.fn(),
    };
    createServerSupabaseClientMock.mockReturnValue({ from: vi.fn(() => query) });

    await updateDonationRecordWithoutReturning("donation-1", {
      razorpayPaymentId: "pay_1",
      paymentStatus: "paid",
    });

    expect(query.eq).toHaveBeenCalledWith("id", "donation-1");
    expect(query.select).not.toHaveBeenCalled();
    expect(query.single).not.toHaveBeenCalled();
  });

  it("getDonationIdByOrderId selects only the donation id", async () => {
    const query = createQuery({
      data: { id: "donation-1" },
      error: null,
    });
    createServerSupabaseClientMock.mockReturnValue({ from: vi.fn(() => query) });

    await expect(getDonationIdByOrderId("order-1")).resolves.toBe("donation-1");

    expect(query.select).toHaveBeenCalledWith(DONATION_ID_SELECT_COLUMNS);
    expect(query.eq).toHaveBeenCalledWith("razorpay_order_id", "order-1");
    expect(query.maybeSingle).toHaveBeenCalledTimes(1);
  });

  it("getDonationStats selects only stats fields", async () => {
    const query = createQuery({
      data: {
        total_amount_in_minor: 10000,
        total_donations: 1,
        monthly_donations: 1,
        last_donation_at: "2026-05-01T00:00:00.000Z",
      },
      error: null,
    });
    createServerSupabaseClientMock.mockReturnValue({ from: vi.fn(() => query) });

    await getDonationStats();

    expect(query.select).toHaveBeenCalledWith(DONATION_STATS_SELECT_COLUMNS);
    expect(query.maybeSingle).toHaveBeenCalledTimes(1);
  });
});

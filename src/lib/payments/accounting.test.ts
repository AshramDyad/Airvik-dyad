import { describe, expect, it } from "vitest";

import {
  summarizeAccountingTransactions,
  type PaymentAccountingTransaction,
} from "@/lib/payments/accounting";

describe("payment accounting", () => {
  it("summarizes online and cash totals separately", () => {
    const transactions: PaymentAccountingTransaction[] = [
      buildTransaction({
        id: "online-1",
        amount: -500,
        paymentMethod: "UPI Gateway",
      }),
      buildTransaction({
        id: "cash-1",
        amount: -300,
        paymentMethod: "Cash",
        receivedBy: "user-1",
        receivedByName: "Reception One",
      }),
      buildTransaction({
        id: "cash-2",
        amount: -200,
        paymentMethod: "Cash",
        receivedBy: "user-1",
        receivedByName: "Reception One",
      }),
      buildTransaction({
        id: "cash-3",
        amount: -100,
        paymentMethod: "Cash",
        receivedBy: "user-2",
        receivedByName: "Reception Two",
      }),
    ];

    const summary = summarizeAccountingTransactions(transactions);

    expect(summary.onlineTotal).toBe(500);
    expect(summary.cashTotal).toBe(600);
    expect(summary.total).toBe(1100);
    expect(summary.onlineCount).toBe(1);
    expect(summary.cashCount).toBe(3);
    expect(summary.cashByReceiver).toEqual([
      {
        receivedBy: "user-1",
        receivedByName: "Reception One",
        amount: 500,
        count: 2,
      },
      {
        receivedBy: "user-2",
        receivedByName: "Reception Two",
        amount: 100,
        count: 1,
      },
    ]);
  });
});

function buildTransaction(
  overrides: Partial<PaymentAccountingTransaction>
): PaymentAccountingTransaction {
  return {
    id: "transaction-1",
    reservationId: "reservation-1",
    bookingId: "A10001",
    description: "Payment",
    amount: -100,
    paymentMethod: "Cash",
    timestamp: "2026-05-24T10:00:00.000Z",
    reference: null,
    receivedBy: null,
    receivedByName: null,
    source: "cash_payment",
    ...overrides,
  };
}

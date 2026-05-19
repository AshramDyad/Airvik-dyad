import { describe, expect, it } from "vitest";

import type { GoogleSheetTransaction } from "@/data/types";
import {
  buildUpiPaymentUri,
  doesTransactionMatchRequest,
  findPaymentRequestMatches,
} from "@/lib/payments/payment-request-matching";

describe("payment request matching", () => {
  it("builds a UPI payment URI with amount and identifier", () => {
    const uri = buildUpiPaymentUri({
      identifier: "AB123",
      amount: 1500,
    });

    expect(uri).toContain("upi://pay?");
    expect(uri).toContain("pa=biz.sahajana959%40fbl");
    expect(uri).toContain("pn=Sahajanand+Wellness");
    expect(uri).toContain("am=1500.00");
    expect(uri).toContain("cu=INR");
    expect(uri).toContain("tr=AB123");
    expect(uri).toContain("tn=Payment+AB123");
  });

  it("matches only credited transactions with the exact amount and identifier", () => {
    const transaction = createTransaction({
      amount: 1200,
      description: "UPI payment XYZ91",
      raw: { credit: "1,200.00", debit: "" },
    });

    expect(
      doesTransactionMatchRequest(transaction, {
        identifier: "XYZ91",
        amount: 1200,
      })
    ).toBe(true);
  });

  it("does not match debits, amount mismatches, or missing identifiers", () => {
    expect(
      doesTransactionMatchRequest(
        createTransaction({
          amount: 1200,
          description: "UPI payment XYZ91",
          raw: { credit: "", debit: "1,200.00" },
        }),
        { identifier: "XYZ91", amount: 1200 }
      )
    ).toBe(false);

    expect(
      doesTransactionMatchRequest(
        createTransaction({
          amount: 1201,
          description: "UPI payment XYZ91",
          raw: { credit: "1,201.00", debit: "" },
        }),
        { identifier: "XYZ91", amount: 1200 }
      )
    ).toBe(false);

    expect(
      doesTransactionMatchRequest(
        createTransaction({
          amount: 1200,
          description: "UPI payment",
          raw: { credit: "1,200.00", debit: "" },
        }),
        { identifier: "XYZ91", amount: 1200 }
      )
    ).toBe(false);
  });

  it("skips expired payment requests", () => {
    const matches = findPaymentRequestMatches(
      [
        {
          id: "request-1",
          identifier: "XYZ91",
          amount: 1200,
          expiresAt: "2026-05-19T09:00:00.000Z",
        },
      ],
      [
        createTransaction({
          amount: 1200,
          description: "UPI payment XYZ91",
          raw: { credit: "1,200.00", debit: "" },
        }),
      ],
      new Date("2026-05-19T10:00:00.000Z")
    );

    expect(matches).toEqual([]);
  });
});

function createTransaction(
  overrides: Partial<GoogleSheetTransaction>
): GoogleSheetTransaction {
  return {
    rowNumber: 2,
    fetchedAt: "2026-05-19T08:00:00.000Z",
    date: "19/05/2026",
    amount: 100,
    amountText: "100.00",
    description: "UPI payment",
    payer: null,
    method: null,
    reference: null,
    status: null,
    raw: {},
    cells: [],
    ...overrides,
  };
}

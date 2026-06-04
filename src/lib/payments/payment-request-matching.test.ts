import { describe, expect, it } from "vitest";

import type { GoogleSheetTransaction } from "@/data/types";
import {
  PAYMENT_AMOUNT_SUFFIX_PAISE,
  buildUpiPaymentUri,
  doesTransactionMatchRequest,
  findPaymentRequestMatches,
  getPaymentRequestAmountWithSuffix,
  getPaymentRequestDisplayCode,
  getStatementCodeFromUpiUri,
  pickAvailablePaymentRequestAmount,
  type PendingPaymentRequestMatch,
} from "@/lib/payments/payment-request-matching";

describe("payment request matching", () => {
  it("builds a UPI payment URI with the statement code as note and reference", () => {
    const uri = buildUpiPaymentUri({
      identifier: "AB123",
      statementCode: "ABCD",
      amount: 1500,
    });

    expect(uri).toContain("upi://pay?");
    expect(uri).toContain("pa=biz.sahajana959%40fbl");
    expect(uri).toContain("pn=Sahajanand+Wellness");
    expect(uri).toContain("am=1500.00");
    expect(uri).toContain("cu=INR");
    expect(uri).toContain("tr=ABCD");
    expect(uri).toContain("tn=ABCD");
    expect(uri).not.toContain("tn=SW-");
  });

  it("keeps legacy UPI payment URI notes when no statement code exists", () => {
    const uri = buildUpiPaymentUri({
      identifier: "AB123",
      amount: 1500,
    });

    expect(uri).toContain("tr=SW-AB123");
    expect(uri).toContain("tn=SW-AB123+Sahajanand+Wellness");
  });

  it("adds a small paise suffix to the requested amount", () => {
    expect(getPaymentRequestAmountWithSuffix(5000, 4)).toBe(5000.04);
    expect(getPaymentRequestAmountWithSuffix(3400, 8)).toBe(3400.08);
  });

  it("picks an unused suffixed amount from active pending amounts", () => {
    expect(
      pickAvailablePaymentRequestAmount({
        amount: 5000,
        activeAmounts: [5000.04],
        suffixes: [4, 8],
      })
    ).toBe(5000.08);
  });

  it("fails when all paise suffixes are already active", () => {
    expect(() =>
      pickAvailablePaymentRequestAmount({
        amount: 5000,
        activeAmounts: PAYMENT_AMOUNT_SUFFIX_PAISE.map((suffix) =>
          getPaymentRequestAmountWithSuffix(5000, suffix)
        ),
      })
    ).toThrow("all paise suffixes are already in use");
  });

  it("reads a statement code from saved UPI URI tn or tr fields", () => {
    const uriWithNote = buildUpiPaymentUri({
      identifier: "AB123",
      statementCode: "EFXG",
      amount: 1,
    });
    const uriWithReferenceOnly =
      "upi://pay?pa=merchant%40upi&pn=Ashram&am=1.00&cu=INR&tn=pay&tr=ZABC";

    expect(getStatementCodeFromUpiUri(uriWithNote)).toBe("EFXG");
    expect(getStatementCodeFromUpiUri(uriWithReferenceOnly)).toBe("ZABC");
    expect(
      getPaymentRequestDisplayCode({
        identifier: "AB123",
        statementCode: null,
        upiUri: uriWithNote,
      })
    ).toBe("EFXG");
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
        statementCode: null,
        amount: 1200,
      })
    ).toBe(true);
  });

  it("matches the prefixed payment code from bank statement text", () => {
    const transaction = createTransaction({
      amount: 1200,
      description: "UPI IN/SW-XYZ91/9537566009@ptsbi/Sahajanand Wellness",
      raw: { credit: "1,200.00", debit: "" },
    });

    expect(
      doesTransactionMatchRequest(transaction, {
        identifier: "XYZ91",
        statementCode: null,
        amount: 1200,
      })
    ).toBe(true);
  });

  it("matches a full statement code with the exact amount", () => {
    const matches = findPaymentRequestMatches(
      [
        createRequest({
          id: "request-1",
          identifier: "XYZ91",
          statementCode: "ABCD",
          amount: 1200,
        }),
      ],
      [
        createTransaction({
          amount: 1200,
          description: "UPI IN/ABCD/9537566009@ptsbi/Sahajanand Wellness",
          raw: { credit: "1,200.00", debit: "" },
        }),
      ],
      new Date("2026-05-19T10:00:00.000Z")
    );

    expect(matches).toHaveLength(1);
    expect(matches[0].request.id).toBe("request-1");
  });

  it("matches a unique dynamic-decimal amount when the bank dropped the code", () => {
    const matches = findPaymentRequestMatches(
      [
        createRequest({
          id: "request-1",
          identifier: "XYZ91",
          statementCode: "ABCD",
          amount: 1200.04,
        }),
        createRequest({
          id: "request-2",
          identifier: "MNO82",
          statementCode: "KJRM",
          amount: 1200.08,
        }),
      ],
      [
        createTransaction({
          amount: 1200.04,
          description: "UPI IN/9537566009@ptsbi/Sahajanand Wellness",
          raw: { credit: "1,200.04", debit: "" },
        }),
      ],
      new Date("2026-05-19T10:00:00.000Z")
    );

    expect(matches).toHaveLength(1);
    expect(matches[0].request.id).toBe("request-1");
  });

  it("does not auto-match a missing-code transaction when the amount is ambiguous", () => {
    const matches = findPaymentRequestMatches(
      [
        createRequest({
          id: "request-1",
          identifier: "XYZ91",
          statementCode: "ABCD",
          amount: 1200.04,
        }),
        createRequest({
          id: "request-2",
          identifier: "MNO82",
          statementCode: "KJRM",
          amount: 1200.04,
        }),
      ],
      [
        createTransaction({
          amount: 1200.04,
          description: "UPI IN/9537566009@ptsbi/Sahajanand Wellness",
          raw: { credit: "1,200.04", debit: "" },
        }),
      ],
      new Date("2026-05-19T10:00:00.000Z")
    );

    expect(matches).toEqual([]);
  });

  it("does not auto-match a whole-rupee missing-code transaction by amount only", () => {
    const matches = findPaymentRequestMatches(
      [
        createRequest({
          id: "request-1",
          identifier: "XYZ91",
          statementCode: "ABCD",
          amount: 1200,
        }),
      ],
      [
        createTransaction({
          amount: 1200,
          description: "UPI IN/9537566009@ptsbi/Sahajanand Wellness",
          raw: { credit: "1,200.00", debit: "" },
        }),
      ],
      new Date("2026-05-19T10:00:00.000Z")
    );

    expect(matches).toEqual([]);
  });

  it("matches an unambiguous two-letter code prefix on the rupee amount", () => {
    const matches = findPaymentRequestMatches(
      [
        createRequest({
          id: "request-1",
          identifier: "XYZ91",
          statementCode: "ABCD",
          amount: 1200,
        }),
        createRequest({
          id: "request-2",
          identifier: "MNO82",
          statementCode: "KJRM",
          amount: 1200,
        }),
      ],
      [
        createTransaction({
          amount: 1200,
          description: "UPI IN/AB/9537566009@ptsbi/Sahajanand Wellness",
          raw: { credit: "1,200.00", debit: "" },
        }),
      ],
      new Date("2026-05-19T10:00:00.000Z")
    );

    expect(matches).toHaveLength(1);
    expect(matches[0].request.id).toBe("request-1");
  });

  it("does not match a one-letter statement prefix", () => {
    const matches = findPaymentRequestMatches(
      [
        createRequest({
          id: "request-1",
          identifier: "XYZ91",
          statementCode: "ZABC",
          amount: 1,
        }),
        createRequest({
          id: "request-2",
          identifier: "MNO82",
          statementCode: "EFXG",
          amount: 1,
        }),
      ],
      [
        createTransaction({
          amount: 1,
          description: "UPI IN/614657278099/kartavyapatel86@okaxis/Z/0000",
          raw: { credit: "1.00", debit: "" },
        }),
      ],
      new Date("2026-05-19T10:00:00.000Z")
    );

    expect(matches).toEqual([]);
  });

  it("does not auto-match an ambiguous two-letter statement prefix", () => {
    const matches = findPaymentRequestMatches(
      [
        createRequest({
          id: "request-1",
          identifier: "XYZ91",
          statementCode: "ABCD",
          amount: 1200,
        }),
        createRequest({
          id: "request-2",
          identifier: "MNO82",
          statementCode: "ABYZ",
          amount: 1200,
        }),
      ],
      [
        createTransaction({
          amount: 1200,
          description: "UPI IN/AB/9537566009@ptsbi/Sahajanand Wellness",
          raw: { credit: "1,200.00", debit: "" },
        }),
      ],
      new Date("2026-05-19T10:00:00.000Z")
    );

    expect(matches).toEqual([]);
  });

  it("does not auto-match an ambiguous one-letter statement prefix", () => {
    const matches = findPaymentRequestMatches(
      [
        createRequest({
          id: "request-1",
          identifier: "XYZ91",
          statementCode: "ZABC",
          amount: 1,
        }),
        createRequest({
          id: "request-2",
          identifier: "MNO82",
          statementCode: "ZFXG",
          amount: 1,
        }),
      ],
      [
        createTransaction({
          amount: 1,
          description: "UPI IN/614657278099/kartavyapatel86@okaxis/Z/0000",
          raw: { credit: "1.00", debit: "" },
        }),
      ],
      new Date("2026-05-19T10:00:00.000Z")
    );

    expect(matches).toEqual([]);
  });

  it("keeps matching legacy SW payment codes for existing pending requests", () => {
    const matches = findPaymentRequestMatches(
      [
        createRequest({
          id: "request-1",
          identifier: "ABC23",
          statementCode: null,
          amount: 1200,
        }),
      ],
      [
        createTransaction({
          amount: 1200,
          description: "UPI IN/SW-ABC23/9537566009@ptsbi/Sahajanand Wellness",
          raw: { credit: "1,200.00", debit: "" },
        }),
      ],
      new Date("2026-05-19T10:00:00.000Z")
    );

    expect(matches).toHaveLength(1);
    expect(matches[0].request.id).toBe("request-1");
  });

  it("does not match a different full statement code with the same amount", () => {
    const matches = findPaymentRequestMatches(
      [
        createRequest({
          id: "request-1",
          identifier: "XYZ91",
          statementCode: "ERTA",
          amount: 1.08,
        }),
      ],
      [
        createTransaction({
          amount: 1.08,
          description: "UPI IN/OJYX/9537566009@ptsbi/Sahajanand Wellness",
          reference: "S17272840",
          raw: { credit: "1.08", debit: "" },
        }),
      ],
      new Date("2026-05-19T10:00:00.000Z")
    );

    expect(matches).toEqual([]);
  });

  it("does not match a transaction fetched before the payment request", () => {
    const matches = findPaymentRequestMatches(
      [
        createRequest({
          id: "request-1",
          identifier: "XYZ91",
          statementCode: "ABCD",
          amount: 1200,
          requestedAt: "2026-05-19T10:08:00.000Z",
        }),
      ],
      [
        createTransaction({
          amount: 1200,
          fetchedAt: "2026-05-19T04:05:00.000Z",
          description: "UPI IN/ABCD/9537566009@ptsbi/Sahajanand Wellness",
          raw: { credit: "1,200.00", debit: "" },
        }),
      ],
      new Date("2026-05-19T11:00:00.000Z")
    );

    expect(matches).toEqual([]);
  });

  it("does not reuse a previously used transaction reference", () => {
    const matches = findPaymentRequestMatches(
      [
        createRequest({
          id: "request-1",
          identifier: "XYZ91",
          statementCode: "ABCD",
          amount: 1200,
        }),
      ],
      [
        createTransaction({
          amount: 1200,
          description: "UPI IN/ABCD/9537566009@ptsbi/Sahajanand Wellness",
          reference: "S17272840",
          raw: { credit: "1,200.00", debit: "" },
        }),
      ],
      {
        now: new Date("2026-05-19T10:00:00.000Z"),
        usedPaymentReferences: new Set(["S17272840"]),
      }
    );

    expect(matches).toEqual([]);
  });

  it("does not match debits, amount mismatches, or missing identifiers", () => {
    expect(
      doesTransactionMatchRequest(
        createTransaction({
          amount: 1200,
          description: "UPI payment XYZ91",
          raw: { credit: "", debit: "1,200.00" },
        }),
        { identifier: "XYZ91", statementCode: null, amount: 1200 }
      )
    ).toBe(false);

    expect(
      doesTransactionMatchRequest(
        createTransaction({
          amount: 1201,
          description: "UPI payment XYZ91",
          raw: { credit: "1,201.00", debit: "" },
        }),
        { identifier: "XYZ91", statementCode: null, amount: 1200 }
      )
    ).toBe(false);

    expect(
      doesTransactionMatchRequest(
        createTransaction({
          amount: 1200,
          description: "UPI payment",
          raw: { credit: "1,200.00", debit: "" },
        }),
        { identifier: "XYZ91", statementCode: null, amount: 1200 }
      )
    ).toBe(false);
  });

  it("skips expired payment requests", () => {
    const matches = findPaymentRequestMatches(
      [
        {
          id: "request-1",
          identifier: "XYZ91",
          statementCode: "ABCD",
          amount: 1200,
          requestedAt: "2026-05-19T08:00:00.000Z",
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

  // ---- Pass 3: dynamic-decimal OR truncated identifier (booking A8840 family) ----

  it("matches the real A8840 row where the bank truncated ACNO to AC", () => {
    const matches = findPaymentRequestMatches(
      [
        createRequest({
          id: "request-1",
          identifier: "4SJHS",
          statementCode: "ACNO",
          amount: 1800.03,
        }),
      ],
      [
        createTransaction({
          amount: 1800.03,
          description: "UPI IN/652134562452/dodiasuresh11@okicici/AC/0000",
          reference: "S46105089",
          raw: { credit: "1,800.03", debit: "" },
        }),
      ],
      new Date("2026-05-19T10:00:00.000Z")
    );

    expect(matches).toHaveLength(1);
    expect(matches[0].request.id).toBe("request-1");
  });

  it("matches on the exact decimal alone when the bank dropped the code entirely", () => {
    const matches = findPaymentRequestMatches(
      [
        createRequest({
          id: "request-1",
          identifier: "4SJHS",
          statementCode: "ACNO",
          amount: 1800.03,
        }),
      ],
      [
        createTransaction({
          amount: 1800.03,
          description: "UPI IN/652134562452/dodiasuresh11@okicici/0000",
          raw: { credit: "1,800.03", debit: "" },
        }),
      ],
      new Date("2026-05-19T10:00:00.000Z")
    );

    expect(matches).toHaveLength(1);
    expect(matches[0].request.id).toBe("request-1");
  });

  it("matches on the rupee amount plus prefix when the guest dropped the decimal", () => {
    const matches = findPaymentRequestMatches(
      [
        createRequest({
          id: "request-1",
          identifier: "4SJHS",
          statementCode: "ACNO",
          amount: 1800.03,
        }),
      ],
      [
        createTransaction({
          amount: 1800,
          description: "UPI IN/652134562452/dodiasuresh11@okicici/AC/0000",
          raw: { credit: "1,800.00", debit: "" },
        }),
      ],
      new Date("2026-05-19T10:00:00.000Z")
    );

    expect(matches).toHaveLength(1);
    expect(matches[0].request.id).toBe("request-1");
  });

  it("matches a three-letter surviving prefix", () => {
    const matches = findPaymentRequestMatches(
      [
        createRequest({
          id: "request-1",
          identifier: "4SJHS",
          statementCode: "ACNO",
          amount: 1800,
        }),
      ],
      [
        createTransaction({
          amount: 1800,
          description: "UPI IN/652134562452/dodiasuresh11@okicici/ACN/0000",
          raw: { credit: "1,800.00", debit: "" },
        }),
      ],
      new Date("2026-05-19T10:00:00.000Z")
    );

    expect(matches).toHaveLength(1);
    expect(matches[0].request.id).toBe("request-1");
  });

  it("uses the exact decimal to pick one of two same-rupee requests", () => {
    const matches = findPaymentRequestMatches(
      [
        createRequest({
          id: "request-1",
          identifier: "4SJHS",
          statementCode: "ACNO",
          amount: 1800.03,
        }),
        createRequest({
          id: "request-2",
          identifier: "MNO82",
          statementCode: "KJRM",
          amount: 1800.05,
        }),
      ],
      [
        createTransaction({
          amount: 1800.03,
          description: "UPI IN/652134562452/dodiasuresh11@okicici/0000",
          raw: { credit: "1,800.03", debit: "" },
        }),
      ],
      new Date("2026-05-19T10:00:00.000Z")
    );

    expect(matches).toHaveLength(1);
    expect(matches[0].request.id).toBe("request-1");
  });

  it("uses the identifier prefix to pick one of two same-rupee requests", () => {
    const matches = findPaymentRequestMatches(
      [
        createRequest({
          id: "request-1",
          identifier: "4SJHS",
          statementCode: "ACNO",
          amount: 1800.03,
        }),
        createRequest({
          id: "request-2",
          identifier: "MNO82",
          statementCode: "KJRM",
          amount: 1800.05,
        }),
      ],
      [
        createTransaction({
          amount: 1800,
          description: "UPI IN/652134562452/dodiasuresh11@okicici/AC/0000",
          raw: { credit: "1,800.00", debit: "" },
        }),
      ],
      new Date("2026-05-19T10:00:00.000Z")
    );

    expect(matches).toHaveLength(1);
    expect(matches[0].request.id).toBe("request-1");
  });

  it("does not match the whole-rupee amount alone", () => {
    const matches = findPaymentRequestMatches(
      [
        createRequest({
          id: "request-1",
          identifier: "4SJHS",
          statementCode: "ACNO",
          amount: 1800,
        }),
      ],
      [
        createTransaction({
          amount: 1800,
          description: "UPI IN/652134562452/dodiasuresh11@okicici/0000",
          raw: { credit: "1,800.00", debit: "" },
        }),
      ],
      new Date("2026-05-19T10:00:00.000Z")
    );

    expect(matches).toEqual([]);
  });

  it("holds a decimal-only match when a different full code is shown", () => {
    const matches = findPaymentRequestMatches(
      [
        createRequest({
          id: "request-1",
          identifier: "4SJHS",
          statementCode: "ACNO",
          amount: 1800.03,
        }),
      ],
      [
        createTransaction({
          amount: 1800.03,
          description: "UPI IN/652134562452/dodiasuresh11@okicici/QAFA/0000",
          raw: { credit: "1,800.03", debit: "" },
        }),
      ],
      new Date("2026-05-19T10:00:00.000Z")
    );

    expect(matches).toEqual([]);
  });

  it("does not match an ambiguous exact decimal shared by two requests", () => {
    const matches = findPaymentRequestMatches(
      [
        createRequest({
          id: "request-1",
          identifier: "4SJHS",
          statementCode: "ACNO",
          amount: 1800.03,
        }),
        createRequest({
          id: "request-2",
          identifier: "MNO82",
          statementCode: "KJRM",
          amount: 1800.03,
        }),
      ],
      [
        createTransaction({
          amount: 1800.03,
          description: "UPI IN/652134562452/dodiasuresh11@okicici/0000",
          raw: { credit: "1,800.03", debit: "" },
        }),
      ],
      new Date("2026-05-19T10:00:00.000Z")
    );

    expect(matches).toEqual([]);
  });

  it("does not match an ambiguous two-letter prefix shared by two codes", () => {
    const matches = findPaymentRequestMatches(
      [
        createRequest({
          id: "request-1",
          identifier: "4SJHS",
          statementCode: "ACNO",
          amount: 1800.03,
        }),
        createRequest({
          id: "request-2",
          identifier: "MNO82",
          statementCode: "ACXY",
          amount: 1800.07,
        }),
      ],
      [
        createTransaction({
          amount: 1800,
          description: "UPI IN/652134562452/dodiasuresh11@okicici/AC/0000",
          raw: { credit: "1,800.00", debit: "" },
        }),
      ],
      new Date("2026-05-19T10:00:00.000Z")
    );

    expect(matches).toEqual([]);
  });

  it("does not match a single-letter surviving prefix", () => {
    const matches = findPaymentRequestMatches(
      [
        createRequest({
          id: "request-1",
          identifier: "4SJHS",
          statementCode: "ACNO",
          amount: 1800.03,
        }),
      ],
      [
        createTransaction({
          amount: 1800,
          description: "UPI IN/652134562452/dodiasuresh11@okicici/A/0000",
          raw: { credit: "1,800.00", debit: "" },
        }),
      ],
      new Date("2026-05-19T10:00:00.000Z")
    );

    expect(matches).toEqual([]);
  });

  it("does not match a stale truncated-code row fetched before the request", () => {
    const matches = findPaymentRequestMatches(
      [
        createRequest({
          id: "request-1",
          identifier: "4SJHS",
          statementCode: "ACNO",
          amount: 1800.03,
          requestedAt: "2026-05-19T10:08:00.000Z",
        }),
      ],
      [
        createTransaction({
          amount: 1800.03,
          fetchedAt: "2026-05-19T04:05:00.000Z",
          description: "UPI IN/652134562452/dodiasuresh11@okicici/AC/0000",
          raw: { credit: "1,800.03", debit: "" },
        }),
      ],
      new Date("2026-05-19T11:00:00.000Z")
    );

    expect(matches).toEqual([]);
  });

  it("does not reuse an already-used reference for a truncated-code row", () => {
    const matches = findPaymentRequestMatches(
      [
        createRequest({
          id: "request-1",
          identifier: "4SJHS",
          statementCode: "ACNO",
          amount: 1800.03,
        }),
      ],
      [
        createTransaction({
          amount: 1800.03,
          description: "UPI IN/652134562452/dodiasuresh11@okicici/AC/0000",
          reference: "S46105089",
          raw: { credit: "1,800.03", debit: "" },
        }),
      ],
      {
        now: new Date("2026-05-19T10:00:00.000Z"),
        usedPaymentReferences: new Set(["S46105089"]),
      }
    );

    expect(matches).toEqual([]);
  });

  it("does not match a debit truncated-code row", () => {
    const matches = findPaymentRequestMatches(
      [
        createRequest({
          id: "request-1",
          identifier: "4SJHS",
          statementCode: "ACNO",
          amount: 1800.03,
        }),
      ],
      [
        createTransaction({
          amount: 1800.03,
          description: "UPI IN/652134562452/dodiasuresh11@okicici/AC/0000",
          raw: { credit: "", debit: "1,800.03" },
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

function createRequest(
  overrides: Partial<PendingPaymentRequestMatch>
): PendingPaymentRequestMatch {
  return {
    id: "request-1",
    identifier: "XYZ91",
    statementCode: "ABCD",
    amount: 1200,
    requestedAt: "2026-05-19T08:00:00.000Z",
    expiresAt: "2026-05-19T11:00:00.000Z",
    ...overrides,
  };
}

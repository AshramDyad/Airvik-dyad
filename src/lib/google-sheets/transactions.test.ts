import { describe, expect, it } from "vitest";

import { parseTransactions } from "./transactions";

const HEADERS = [
  "transaction_id",
  "fetched_at",
  "account",
  "txn_date",
  "value_date",
  "description",
  "reference",
  "debit",
  "credit",
  "amount",
  "balance",
  "raw_json",
  "hide",
];

// Build one sheet row. `hide` is the last cell (column M); `reference`/`amount`
// are kept unique so dedupeByReference never collapses unrelated rows.
function buildCells(reference: string, amount: string, hide: string): string[] {
  return [
    `txn-${reference}`, // transaction_id
    "", // fetched_at
    "Main", // account
    "2026-06-08", // txn_date
    "2026-06-08", // value_date
    `UPI IN/${reference}`, // description
    reference, // reference
    "", // debit
    amount, // credit
    amount, // amount
    "1000", // balance
    "{}", // raw_json
    hide, // hide
  ];
}

const RANGE = "Transactions!A1:M";

describe("parseTransactions hide column", () => {
  it("drops a row whose hide cell is the word 'hide'", () => {
    const values = [HEADERS, buildCells("REF1", "100", "hide")];

    const payload = parseTransactions(values, "sheet-id", RANGE);

    expect(payload.rows).toHaveLength(0);
  });

  it("drops a row regardless of the casing of 'hide'", () => {
    const values = [HEADERS, buildCells("REF1", "100", "HIDE")];

    const payload = parseTransactions(values, "sheet-id", RANGE);

    expect(payload.rows).toHaveLength(0);
  });

  it("keeps rows with an empty or non-'hide' marker", () => {
    const values = [
      HEADERS,
      buildCells("REF1", "100", ""),
      buildCells("REF2", "200", "yes"),
      buildCells("REF3", "300", "TRUE"),
    ];

    const payload = parseTransactions(values, "sheet-id", RANGE);

    expect(payload.rows.map((row) => row.reference)).toEqual([
      "REF1",
      "REF2",
      "REF3",
    ]);
  });

  it("keeps only the visible rows when hidden rows are mixed in", () => {
    const values = [
      HEADERS,
      buildCells("REF1", "100", ""),
      buildCells("REF2", "200", "hide"),
      buildCells("REF3", "300", ""),
    ];

    const payload = parseTransactions(values, "sheet-id", RANGE);

    expect(payload.rows.map((row) => row.reference)).toEqual(["REF1", "REF3"]);
  });

  it("keeps every row when the sheet has no hide column", () => {
    const headersWithoutHide = HEADERS.slice(0, -1);
    const values = [
      headersWithoutHide,
      buildCells("REF1", "100", "hide").slice(0, -1),
      buildCells("REF2", "200", "hide").slice(0, -1),
    ];

    const payload = parseTransactions(
      values,
      "sheet-id",
      "Transactions!A1:L"
    );

    expect(payload.rows.map((row) => row.reference)).toEqual(["REF1", "REF2"]);
  });
});

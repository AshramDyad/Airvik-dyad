import { describe, expect, it } from "vitest";

import type { GoogleSheetTransaction } from "@/data/types";

import { dedupeByReference } from "./dedupe";

function buildRow(
  overrides: Partial<GoogleSheetTransaction> & { rowNumber: number }
): GoogleSheetTransaction {
  return {
    fetchedAt: null,
    date: "2026-06-08",
    amount: 100,
    amountText: "100",
    description: null,
    payer: null,
    method: null,
    reference: null,
    status: null,
    raw: {},
    cells: [],
    ...overrides,
  };
}

describe("dedupeByReference", () => {
  it("collapses a label duplicate and keeps the real description", () => {
    const realRow = buildRow({
      rowNumber: 6,
      reference: "S14418531",
      description: "UPI IN/615975173960/sanjaysinh6555-2@oksbi/U/4816",
    });
    const labelRow = buildRow({
      rowNumber: 2,
      reference: "S14418531",
      description: "Particulars",
    });

    const result = dedupeByReference([labelRow, realRow]);

    expect(result).toHaveLength(1);
    expect(result[0].description).toBe(
      "UPI IN/615975173960/sanjaysinh6555-2@oksbi/U/4816"
    );
  });

  it("keeps two distinct references as two rows", () => {
    const first = buildRow({ rowNumber: 1, reference: "S1", description: "UPI IN/a" });
    const second = buildRow({ rowNumber: 2, reference: "S2", description: "UPI IN/b" });

    const result = dedupeByReference([first, second]);

    expect(result).toHaveLength(2);
    expect(result.map((row) => row.reference)).toEqual(["S1", "S2"]);
  });

  it("never collapses rows that have no reference", () => {
    const first = buildRow({ rowNumber: 1, reference: null, description: "Cash A" });
    const second = buildRow({ rowNumber: 2, reference: "", description: "Cash B" });
    const third = buildRow({ rowNumber: 3, reference: "   ", description: "Cash C" });

    const result = dedupeByReference([first, second, third]);

    expect(result).toHaveLength(3);
  });

  it("preserves the original order, emitting each reference at its first position", () => {
    const labelTop = buildRow({ rowNumber: 2, reference: "S14418531", description: "Particulars" });
    const other = buildRow({ rowNumber: 5, reference: "S2", description: "UPI IN/b" });
    const realLater = buildRow({
      rowNumber: 6,
      reference: "S14418531",
      description: "UPI IN/real",
    });

    const result = dedupeByReference([labelTop, other, realLater]);

    expect(result.map((row) => row.reference)).toEqual(["S14418531", "S2"]);
    // The first reference keeps its leading position but takes the real description.
    expect(result[0].description).toBe("UPI IN/real");
  });

  it("matches references case- and whitespace-insensitively", () => {
    const labelRow = buildRow({ rowNumber: 1, reference: " s100 ", description: "Particulars" });
    const realRow = buildRow({ rowNumber: 2, reference: "S100", description: "UPI IN/x" });

    const result = dedupeByReference([labelRow, realRow]);

    expect(result).toHaveLength(1);
    expect(result[0].description).toBe("UPI IN/x");
  });
});

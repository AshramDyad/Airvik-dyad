import type { GoogleSheetTransaction } from "@/data/types";

// The bot occasionally stored the bare column label as a transaction note, creating duplicate
// rows. These are the label values we treat as "not a real description".
const REFERENCE_LABELS = new Set(["particulars", "particular"]);

function hasRealDescription(transaction: GoogleSheetTransaction): boolean {
  const description = (transaction.description ?? "").trim().toLowerCase();
  return description.length > 0 && !REFERENCE_LABELS.has(description);
}

/**
 * Collapses rows that share the same bank reference (Transaction ID) into one, keeping the row
 * with a real description over the corrupted literal label ("Particulars"). Rows without a
 * reference are kept untouched, and the original order of surviving rows is preserved.
 */
export function dedupeByReference(
  rows: GoogleSheetTransaction[]
): GoogleSheetTransaction[] {
  const bestByReference = new Map<string, GoogleSheetTransaction>();

  for (const row of rows) {
    const reference = (row.reference ?? "").trim().toUpperCase();
    if (!reference) {
      continue;
    }
    const current = bestByReference.get(reference);
    if (!current || (!hasRealDescription(current) && hasRealDescription(row))) {
      bestByReference.set(reference, row);
    }
  }

  const emitted = new Set<string>();
  const result: GoogleSheetTransaction[] = [];

  for (const row of rows) {
    const reference = (row.reference ?? "").trim().toUpperCase();
    if (!reference) {
      result.push(row);
      continue;
    }
    if (emitted.has(reference)) {
      continue;
    }
    emitted.add(reference);
    result.push(bestByReference.get(reference) ?? row);
  }

  return result;
}

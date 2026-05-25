import { describe, expect, it } from "vitest";

import { isReservationUuid } from "./identifiers";

describe("reservation identifier helpers", () => {
  it("accepts canonical reservation UUIDs", () => {
    expect(isReservationUuid("c30213b0-e12d-4c7c-bd0e-573356a9ef92")).toBe(
      true
    );
    expect(isReservationUuid("C30213B0-E12D-4C7C-BD0E-573356A9EF92")).toBe(
      true
    );
  });

  it("rejects the old broken four-segment UUID shape", () => {
    expect(isReservationUuid("c30213b0-e12d-4c7c-573356a9ef92")).toBe(false);
  });

  it("rejects booking codes and empty values", () => {
    expect(isReservationUuid("BK-2026-0001")).toBe(false);
    expect(isReservationUuid("")).toBe(false);
    expect(isReservationUuid(undefined)).toBe(false);
    expect(isReservationUuid(null)).toBe(false);
  });
});

import { describe, expect, it } from "vitest";

import { normalizeReservationPaymentRequestStatus } from "./reservation-payment-requests";

describe("normalizeReservationPaymentRequestStatus", () => {
  it("keeps active statuses unchanged when within expiry window", () => {
    const status = normalizeReservationPaymentRequestStatus(
      "requested",
      "2099-12-31T23:59:59.000Z",
      new Date("2025-01-01T00:00:00.000Z").getTime()
    );

    expect(status).toBe("requested");
  });

  it("marks requested and partially paid as expired when expiry time is past", () => {
    const now = new Date("2026-01-01T12:00:00.000Z").getTime();
    expect(
      normalizeReservationPaymentRequestStatus(
        "requested",
        "2025-12-31T23:59:59.000Z",
        now
      )
    ).toBe("expired");
    expect(
      normalizeReservationPaymentRequestStatus(
        "partially_paid",
        "2025-12-31T23:59:59.000Z",
        now
      )
    ).toBe("expired");
  });

  it("does not overwrite terminal paid/cancelled states", () => {
    const now = new Date("2026-01-01T12:00:00.000Z").getTime();
    expect(
      normalizeReservationPaymentRequestStatus("paid", "2025-12-31T23:59:59.000Z", now)
    ).toBe("paid");
    expect(
      normalizeReservationPaymentRequestStatus(
        "cancelled",
        "2025-12-31T23:59:59.000Z",
        now
      )
    ).toBe("cancelled");
  });

  it("treats malformed expiry as non-expiring for active states", () => {
    expect(
      normalizeReservationPaymentRequestStatus(
        "requested",
        "not-a-date",
        new Date("2026-01-01T00:00:00.000Z").getTime()
      )
    ).toBe("requested");
  });

  it("falls back to cancelled for unknown statuses", () => {
    expect(
      normalizeReservationPaymentRequestStatus(
        "some-unknown-state",
        null,
        Date.now()
      )
    ).toBe("cancelled");
  });
});

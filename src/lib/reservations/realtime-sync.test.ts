import { describe, expect, it } from "vitest";

import {
  createReservationSyncMessage,
  getFolioItemRealtimeHint,
  getReservationRealtimeHint,
  parseReservationSyncMessage,
  parseReservationSyncStorageValue,
} from "@/lib/reservations/realtime-sync";

describe("reservation realtime sync helpers", () => {
  it("creates and parses a reservation sync message", () => {
    const message = createReservationSyncMessage({
      sourceId: "tab-1",
      revision: 3,
      createdAt: 1_774_800_000_000,
      reservationId: "reservation-1",
      bookingId: "booking-1",
    });

    expect(parseReservationSyncMessage(message)).toEqual(message);
    expect(parseReservationSyncStorageValue(JSON.stringify(message))).toEqual(
      message
    );
  });

  it("rejects invalid sync messages", () => {
    expect(parseReservationSyncMessage(null)).toBeNull();
    expect(parseReservationSyncMessage({ type: "other" })).toBeNull();
    expect(
      parseReservationSyncStorageValue("{not-valid-json")
    ).toBeNull();
  });

  it("extracts reservation hints from realtime rows", () => {
    expect(
      getReservationRealtimeHint({
        id: "reservation-1",
        booking_id: "booking-1",
      })
    ).toEqual({
      reservationId: "reservation-1",
      bookingId: "booking-1",
    });

    expect(
      getFolioItemRealtimeHint({
        reservation_id: "reservation-2",
      })
    ).toEqual({
      reservationId: "reservation-2",
    });
  });
});

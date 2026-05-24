import { describe, expect, it } from "vitest";

import {
  ACTIVE_RESERVATION_STATUSES,
  doesReservationBlockAvailability,
  getActiveHoldRoomIdsForDateRange,
  getReservationStatusLabel,
  getRoomHoldExpiresAt,
  hasActiveReservations,
  isActiveRoomHold,
  isActiveReservationStatus,
  ROOM_HOLD_LABEL,
  resolveAggregateStatus,
} from "./status";

describe("reservation status helpers", () => {
  it("identifies active statuses", () => {
    for (const status of ACTIVE_RESERVATION_STATUSES) {
      expect(isActiveReservationStatus(status)).toBe(true);
    }
    expect(isActiveReservationStatus("Cancelled")).toBe(false);
    expect(isActiveReservationStatus("No-show")).toBe(false);
  });

  it("detects when a list contains active reservations", () => {
    expect(hasActiveReservations(["Cancelled", "No-show"])).toBe(false);
    expect(hasActiveReservations(["Cancelled", "Confirmed"])).toBe(true);
  });

  it("resolves aggregate status by priority", () => {
    expect(
      resolveAggregateStatus(["Room Hold", "Confirmed", "Checked-in"])
    ).toBe("Checked-in");
    expect(resolveAggregateStatus(["Cancelled", "No-show"])).toBe("Cancelled");
    expect(resolveAggregateStatus([])).toBe("Cancelled");
  });

  it("labels room hold for admin display", () => {
    expect(getReservationStatusLabel("Room Hold")).toBe(ROOM_HOLD_LABEL);
    expect(getReservationStatusLabel("Confirmed")).toBe("Confirmed");
  });

  it("creates a 30 minute hold expiry", () => {
    const now = new Date("2026-05-24T10:00:00.000Z");
    expect(getRoomHoldExpiresAt(now)).toBe("2026-05-24T10:30:00.000Z");
  });

  it("blocks availability only for active room holds", () => {
    const now = new Date("2026-05-24T10:00:00.000Z");
    const activeHold = {
      status: "Room Hold" as const,
      holdExpiresAt: "2026-05-24T10:01:00.000Z",
    };
    const expiredHold = {
      status: "Room Hold" as const,
      holdExpiresAt: "2026-05-24T09:59:00.000Z",
    };

    expect(isActiveRoomHold(activeHold, now)).toBe(true);
    expect(doesReservationBlockAvailability(activeHold, now)).toBe(true);
    expect(isActiveRoomHold(expiredHold, now)).toBe(false);
    expect(doesReservationBlockAvailability(expiredHold, now)).toBe(false);
  });

  it("keeps confirmed blocking and cancelled/no-show non-blocking", () => {
    const now = new Date("2026-05-24T10:00:00.000Z");

    expect(
      doesReservationBlockAvailability(
        { status: "Confirmed", holdExpiresAt: null },
        now
      )
    ).toBe(true);
    expect(
      doesReservationBlockAvailability(
        { status: "Cancelled", holdExpiresAt: null },
        now
      )
    ).toBe(false);
    expect(
      doesReservationBlockAvailability(
        { status: "No-show", holdExpiresAt: null },
        now
      )
    ).toBe(false);
  });

  it("finds active held rooms for the selected date range", () => {
    const now = new Date("2026-05-24T10:00:00.000Z");
    const heldRoomIds = getActiveHoldRoomIdsForDateRange(
      [
        {
          roomId: "room-1",
          checkInDate: "2026-06-01",
          checkOutDate: "2026-06-03",
          status: "Room Hold",
          holdExpiresAt: "2026-05-24T10:30:00.000Z",
        },
        {
          roomId: "room-2",
          checkInDate: "2026-06-01",
          checkOutDate: "2026-06-03",
          status: "Room Hold",
          holdExpiresAt: "2026-05-24T09:59:00.000Z",
        },
        {
          roomId: "room-3",
          checkInDate: "2026-07-01",
          checkOutDate: "2026-07-03",
          status: "Room Hold",
          holdExpiresAt: "2026-05-24T10:30:00.000Z",
        },
      ],
      {
        from: new Date("2026-06-02T00:00:00"),
        to: new Date("2026-06-04T00:00:00"),
      },
      now
    );

    expect(heldRoomIds.has("room-1")).toBe(true);
    expect(heldRoomIds.has("room-2")).toBe(false);
    expect(heldRoomIds.has("room-3")).toBe(false);
  });
});

import { describe, expect, it } from "vitest";

import {
  BUTTON_BALANCE_DUE,
  BUTTON_BOOKING_DETAILS,
  BUTTON_TALK_SUPPORT,
  routeInbound,
  type BookingSummary,
} from "./booking-replies";

const BOOKING: BookingSummary = {
  guestName: "Asha Patel",
  bookingId: "BK-1001",
  status: "Confirmed",
  checkInDate: "2026-07-01",
  balanceDue: 2500,
};

describe("routeInbound", () => {
  it("asks the guest to identify themselves when no booking matches", () => {
    const reply = routeInbound({ from: "919876543210", text: "hi" }, null);
    expect(reply.kind).toBe("text");
    if (reply.kind === "text") {
      expect(reply.body).toContain("couldn't find");
    }
  });

  it("shows the menu for free-form text when a booking is found", () => {
    const reply = routeInbound({ from: "919876543210", text: "hello" }, BOOKING);
    expect(reply.kind).toBe("buttons");
    if (reply.kind === "buttons") {
      expect(reply.buttons).toHaveLength(3);
      expect(reply.buttons.map((b) => b.id)).toEqual([
        BUTTON_BOOKING_DETAILS,
        BUTTON_BALANCE_DUE,
        BUTTON_TALK_SUPPORT,
      ]);
      expect(reply.body).toContain("Asha Patel");
    }
  });

  it("reports the outstanding balance when there is one", () => {
    const reply = routeInbound({ from: "919876543210", buttonId: BUTTON_BALANCE_DUE }, BOOKING);
    expect(reply.kind).toBe("text");
    if (reply.kind === "text") {
      expect(reply.body).toContain("₹2,500.00");
      expect(reply.body).toContain("BK-1001");
    }
  });

  it("says all-paid when the balance is zero", () => {
    const reply = routeInbound(
      { from: "919876543210", buttonId: BUTTON_BALANCE_DUE },
      { ...BOOKING, balanceDue: 0 },
    );
    expect(reply.kind).toBe("text");
    if (reply.kind === "text") {
      expect(reply.body).toContain("all paid up");
    }
  });

  it("returns the booking details on the details button", () => {
    const reply = routeInbound({ from: "919876543210", buttonId: BUTTON_BOOKING_DETAILS }, BOOKING);
    expect(reply.kind).toBe("text");
    if (reply.kind === "text") {
      expect(reply.body).toContain("BK-1001");
      expect(reply.body).toContain("Confirmed");
      expect(reply.body).toContain("2026-07-01");
    }
  });

  it("hands over to a human on the support button", () => {
    const reply = routeInbound({ from: "919876543210", buttonId: BUTTON_TALK_SUPPORT }, BOOKING);
    expect(reply.kind).toBe("text");
    if (reply.kind === "text") {
      expect(reply.body).toContain("team member");
    }
  });
});

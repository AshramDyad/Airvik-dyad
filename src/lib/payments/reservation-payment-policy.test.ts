import { describe, expect, it } from "vitest";

import {
  getNewRoomReservationStatusForPayment,
  getRequiredReservationStatusForPayment,
  isCashPaymentMethod,
  isGatewayPaymentMethod,
  isNewReservationPaymentMethod,
  validateReservationPaymentAmount,
} from "@/lib/payments/reservation-payment-policy";

describe("reservation payment policy", () => {
  it("allows only Cash and UPI Gateway for new reservations", () => {
    expect(isNewReservationPaymentMethod("Cash")).toBe(true);
    expect(isNewReservationPaymentMethod("UPI Gateway")).toBe(true);
    expect(isNewReservationPaymentMethod("UPI")).toBe(false);
    expect(isNewReservationPaymentMethod("Bank/IMPS")).toBe(false);
  });

  it("derives the required status from payment method", () => {
    expect(getRequiredReservationStatusForPayment("UPI Gateway")).toBe("Room Hold");
    expect(getRequiredReservationStatusForPayment("Cash")).toBe("Confirmed");
  });

  it("starts newly added UPI Gateway rooms as room holds", () => {
    expect(
      getNewRoomReservationStatusForPayment({
        paymentMethod: "UPI Gateway",
        currentStatus: "Confirmed",
      })
    ).toBe("Room Hold");
    expect(
      getNewRoomReservationStatusForPayment({
        paymentMethod: "UPI Gateway",
        currentStatus: "Room Hold",
      })
    ).toBe("Room Hold");
  });

  it("keeps the current status for newly added non-gateway rooms", () => {
    expect(
      getNewRoomReservationStatusForPayment({
        paymentMethod: "Cash",
        currentStatus: "Confirmed",
      })
    ).toBe("Confirmed");
    expect(
      getNewRoomReservationStatusForPayment({
        paymentMethod: "Not specified",
        currentStatus: "Standby",
      })
    ).toBe("Standby");
  });

  it("recognizes official accounting methods", () => {
    expect(isCashPaymentMethod("Cash")).toBe(true);
    expect(isGatewayPaymentMethod("UPI Gateway")).toBe(true);
    expect(isCashPaymentMethod("Bank Transfer")).toBe(false);
    expect(isGatewayPaymentMethod(null)).toBe(false);
  });

  it("rejects empty, negative, and over-balance payment amounts", () => {
    expect(validateReservationPaymentAmount({ amount: 0, balanceDue: 100 })).toBe(
      "Enter a valid payment amount."
    );
    expect(validateReservationPaymentAmount({ amount: -5, balanceDue: 100 })).toBe(
      "Enter a valid payment amount."
    );
    expect(validateReservationPaymentAmount({ amount: 101, balanceDue: 100 })).toBe(
      "Payment amount cannot be more than the balance due."
    );
    expect(validateReservationPaymentAmount({ amount: 100, balanceDue: 100 })).toBeNull();
  });
});

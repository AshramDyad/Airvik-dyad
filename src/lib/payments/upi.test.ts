import { describe, expect, it } from "vitest";

import {
  buildReservationPaymentIntentLink,
  buildReservationPaymentLaunchLinks,
  buildReservationPaymentQrUrl,
  buildReservationPaymentUpiLink,
  calculateRemainingPaymentAmount,
} from "./upi";

describe("UPI payment link helpers", () => {
  it("builds a UPI link using remaining amount", () => {
    const link = buildReservationPaymentUpiLink(
      {
        amount: 750,
        paidAmount: 200.5,
        token: "REQ-123",
      },
      { upiId: "hotel@upi", upiMerchantName: "Hotel Name" }
    );

    expect(link).toBe(
      "upi://pay?pa=hotel%40upi&pn=Hotel+Name&am=549.50&cu=INR&tr=REQ-123&tn=Reservation+payment%3A+REQ-123"
    );
  });

  it("falls back to Hotel when merchant name is missing and rounds to 2 decimals", () => {
    const link = buildReservationPaymentUpiLink(
      {
        amount: 1200,
        paidAmount: 300.499,
        token: "REQ-ABC",
      },
      { upiId: "hotel@upi", upiMerchantName: "   " },
      "INR"
    );

    expect(link).toContain("pn=Hotel");
    expect(link).toContain("am=899.50");
  });

  it("returns null when UPI ID is missing", () => {
    const request = {
      amount: 100,
      paidAmount: 0,
      token: "REQ-NO-UPI",
    };
    expect(
      buildReservationPaymentUpiLink(request, { upiId: "   ", upiMerchantName: "Hotel" })
    ).toBeNull();
    expect(
      buildReservationPaymentIntentLink(
        request,
        { upiId: "", upiMerchantName: "Hotel" },
        "https://example.com/pay/REQ-NO-UPI"
      )
    ).toBeNull();
  });

  it("builds an Android intent URL with encoded fallback URL", () => {
    const intent = buildReservationPaymentIntentLink(
      {
        amount: 1200,
        paidAmount: 200,
        token: "REQ-INTENT",
      },
      { upiId: "hotel@upi", upiMerchantName: "Hotel Name" },
      "https://example.com/pay/REQ-INTENT",
      "INR"
    );

    expect(intent).not.toBeNull();
    expect(intent).toContain("intent://pay?");
    expect(intent).toContain("S.browser_fallback_url=https%3A%2F%2Fexample.com%2Fpay%2FREQ-INTENT;");
    expect(intent).toContain("scheme=upi;");
    expect(intent).toContain("action=android.intent.action.VIEW;");
  });

  it("returns both UPI and intent links from the launch helper", () => {
    const links = buildReservationPaymentLaunchLinks(
      {
        amount: 100,
        paidAmount: 25,
        token: "REQ-LINK",
      },
      { upiId: "hotel@upi", upiMerchantName: "Hotel" },
      "https://example.com/pay/REQ-LINK"
    );

    expect(links.upiLink).toBe(
      "upi://pay?pa=hotel%40upi&pn=Hotel&am=75.00&cu=INR&tr=REQ-LINK&tn=Reservation+payment%3A+REQ-LINK"
    );
    expect(links.intentLink).toContain(
      "intent://pay?pa=hotel%40upi&pn=Hotel&am=75.00&cu=INR&tr=REQ-LINK&tn=Reservation+payment%3A+REQ-LINK"
    );
    expect(links.intentLink).toContain("S.browser_fallback_url=");
  });

  it("builds a QR URL for any UPI deep link", () => {
    const qrUrl = buildReservationPaymentQrUrl(
      "upi://pay?pa=hotel%40upi&pn=Hotel&am=10.00&cu=INR&tr=REQ&tn=Reservation",
      300
    );

    expect(qrUrl).toBe(
      "https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=upi%3A%2F%2Fpay%3Fpa%3Dhotel%2540upi%26pn%3DHotel%26am%3D10.00%26cu%3DINR%26tr%3DREQ%26tn%3DReservation"
    );
  });

  it("calculates remaining request amount", () => {
    expect(
      calculateRemainingPaymentAmount({
        amount: 500,
        paidAmount: 125.126,
      })
    ).toBe(374.87);
    expect(
      calculateRemainingPaymentAmount({
        amount: 50,
        paidAmount: 60,
      })
    ).toBe(0);
  });
});

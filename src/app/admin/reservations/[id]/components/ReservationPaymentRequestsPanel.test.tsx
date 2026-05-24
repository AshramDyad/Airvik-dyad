import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useAuthContext } from "@/context/auth-context";
import { useDataContext } from "@/context/data-context";
import type { PaymentRequest, Permission } from "@/data/types";
import { authorizedFetch } from "@/lib/auth/client-session";
import { ReservationPaymentRequestsPanel } from "./ReservationPaymentRequestsPanel";

vi.mock("@/context/auth-context", () => ({
  useAuthContext: vi.fn(),
}));

vi.mock("@/context/data-context", () => ({
  useDataContext: vi.fn(),
}));

vi.mock("@/lib/auth/client-session", () => ({
  authorizedFetch: vi.fn(),
}));

vi.mock("@/lib/payments/payment-qr-client", () => ({
  createPaymentQrBlob: vi.fn(),
  createShareablePaymentQrImage: vi.fn(),
  downloadDataUrl: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

const mockedUseAuthContext = vi.mocked(useAuthContext);
const mockedUseDataContext = vi.mocked(useDataContext);
const mockedAuthorizedFetch = vi.mocked(authorizedFetch);

describe("ReservationPaymentRequestsPanel", () => {
  beforeEach(() => {
    mockedAuthorizedFetch.mockReset();
    mockedUseDataContext.mockReturnValue({
      refreshReservations: vi.fn().mockResolvedValue(undefined),
      loadBookingDetails: vi.fn().mockResolvedValue(undefined),
    } as unknown as ReturnType<typeof useDataContext>);
  });

  it("hides admin override when the role does not have update payment permission", async () => {
    mockedUseAuthContext.mockReturnValue({
      hasPermission: () => false,
    } as unknown as ReturnType<typeof useAuthContext>);
    mockedAuthorizedFetch.mockResolvedValue(
      jsonResponse({ requests: [] }, { status: 200 })
    );

    renderPanel();

    await screen.findByText("No payment QR created for this reservation.");
    expect(
      screen.queryByRole("button", { name: /admin confirm/i })
    ).not.toBeInTheDocument();
  });

  it("records an admin override and refreshes reservation state", async () => {
    const user = userEvent.setup();
    const refreshReservations = vi.fn().mockResolvedValue(undefined);
    const loadBookingDetails = vi.fn().mockResolvedValue(undefined);
    mockedUseDataContext.mockReturnValue({
      refreshReservations,
      loadBookingDetails,
    } as unknown as ReturnType<typeof useDataContext>);
    mockedUseAuthContext.mockReturnValue({
      hasPermission: (permission: Permission) => permission === "update:payment",
    } as unknown as ReturnType<typeof useAuthContext>);
    mockedAuthorizedFetch
      .mockResolvedValueOnce(jsonResponse({ requests: [] }, { status: 200 }))
      .mockResolvedValueOnce(
        jsonResponse({ folioItem: { id: "folio-override-1" } }, { status: 201 })
      )
      .mockResolvedValueOnce(
        jsonResponse({ requests: [buildPaidRequest()] }, { status: 200 })
      );

    renderPanel();

    await user.click(await screen.findByRole("button", { name: /admin confirm/i }));
    await user.clear(screen.getByLabelText("Paid Amount"));
    await user.type(screen.getByLabelText("Paid Amount"), "1500");
    await user.type(screen.getByLabelText("Reference"), "UPI123");
    await user.type(screen.getByLabelText("Reason"), "Verified in bank app");
    await user.click(screen.getByRole("button", { name: /confirm booking/i }));

    await waitFor(() => {
      expect(mockedAuthorizedFetch).toHaveBeenCalledWith(
        "/api/admin/reservations/reservation-1/payment-override",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            amount: 1500,
            reference: "UPI123",
            reason: "Verified in bank app",
          }),
        })
      );
    });
    expect(refreshReservations).toHaveBeenCalled();
    expect(loadBookingDetails).toHaveBeenCalledWith("reservation-1");
  });
});

function renderPanel() {
  render(
    <ReservationPaymentRequestsPanel
      reservationId="reservation-1"
      guest={null}
      balanceDue={1500}
      currency="INR"
      logoUrl=""
    />
  );
}

function jsonResponse(body: unknown, init: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { "Content-Type": "application/json" },
  });
}

function buildPaidRequest(): PaymentRequest {
  return {
    id: "payment-request-1",
    identifier: "ABCDE",
    reservationId: "reservation-1",
    folioItemId: "folio-override-1",
    amount: 1500,
    paidAmount: 1500,
    status: "paid",
    upiId: "merchant@upi",
    upiMerchantName: "Ashram",
    upiUri: "upi://pay?pa=merchant@upi&am=1500",
    requestedAt: "2026-05-24T08:00:00.000Z",
    expiresAt: "2026-05-24T08:30:00.000Z",
    paidAt: "2026-05-24T08:10:00.000Z",
    paymentReference: "UPI123",
    matchedTransaction: null,
    notes: null,
    createdBy: "user-1",
    createdAt: "2026-05-24T08:00:00.000Z",
    updatedAt: "2026-05-24T08:10:00.000Z",
  };
}

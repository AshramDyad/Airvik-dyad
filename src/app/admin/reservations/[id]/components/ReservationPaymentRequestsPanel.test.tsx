import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useAuthContext } from "@/context/auth-context";
import { useDataContext } from "@/context/data-context";
import type { PaymentRequest, Permission } from "@/data/types";
import { authorizedFetch } from "@/lib/auth/client-session";
import { revalidateReservationsCache } from "@/lib/reservations/cache-client";
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

vi.mock("@/lib/reservations/cache-client", () => ({
  revalidateReservationsCache: vi.fn(),
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
const mockedRevalidateReservationsCache = vi.mocked(revalidateReservationsCache);

describe("ReservationPaymentRequestsPanel", () => {
  beforeEach(() => {
    mockedAuthorizedFetch.mockReset();
    mockedRevalidateReservationsCache.mockReset();
    mockedRevalidateReservationsCache.mockResolvedValue(true);
    mockedUseDataContext.mockReturnValue({
      refreshReservations: vi.fn().mockResolvedValue(undefined),
      loadBookingDetails: vi.fn().mockResolvedValue(undefined),
      notifyReservationsChanged: vi.fn(),
    } as unknown as ReturnType<typeof useDataContext>);
  });

  it("keeps the amount field empty after the user clears the prefilled balance", async () => {
    const user = userEvent.setup();
    mockedUseAuthContext.mockReturnValue({
      hasPermission: () => false,
    } as unknown as ReturnType<typeof useAuthContext>);
    mockedAuthorizedFetch.mockResolvedValue(
      jsonResponse({ requests: [] }, { status: 200 })
    );

    renderPanel({ balanceDue: 1500 });

    const amountInput = await screen.findByLabelText("UPI Gateway Amount");
    expect(amountInput).toHaveValue(1500);

    await user.clear(amountInput);

    await waitFor(() => {
      expect(amountInput).toHaveValue(null);
    });
    expect(amountInput).toHaveValue(null);
  });

  it("hides the per-row Confirm button when the role lacks update payment permission", async () => {
    mockedUseAuthContext.mockReturnValue({
      hasPermission: () => false,
    } as unknown as ReturnType<typeof useAuthContext>);
    mockedAuthorizedFetch.mockResolvedValue(
      jsonResponse({ requests: [buildPendingRequest(1500)] }, { status: 200 })
    );

    renderPanel();

    await screen.findByText("XALP");
    expect(
      screen.queryByRole("button", { name: "Confirm" })
    ).not.toBeInTheDocument();
  });

  it("shows the Confirm button only on pending rows", async () => {
    const expiredRequest = {
      ...buildPendingRequest(1500),
      id: "payment-request-expired",
      statementCode: "EXPD",
      status: "expired",
    } satisfies PaymentRequest;
    mockedUseAuthContext.mockReturnValue({
      hasPermission: (permission: Permission) => permission === "update:payment",
    } as unknown as ReturnType<typeof useAuthContext>);
    mockedAuthorizedFetch.mockResolvedValue(
      jsonResponse(
        { requests: [buildPaidRequest(), expiredRequest] },
        { status: 200 }
      )
    );

    renderPanel();

    await screen.findByText("KJRM");
    // Paid and expired rows are present, but neither exposes a Confirm button.
    expect(screen.getByText("EXPD")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Confirm" })
    ).not.toBeInTheDocument();
  });

  it("confirms a single pending QR and refreshes reservation state", async () => {
    const user = userEvent.setup();
    const refreshReservations = vi.fn().mockResolvedValue(undefined);
    const loadBookingDetails = vi.fn().mockResolvedValue(undefined);
    const notifyReservationsChanged = vi.fn();
    mockedUseDataContext.mockReturnValue({
      refreshReservations,
      loadBookingDetails,
      notifyReservationsChanged,
    } as unknown as ReturnType<typeof useDataContext>);
    mockedUseAuthContext.mockReturnValue({
      hasPermission: (permission: Permission) => permission === "update:payment",
    } as unknown as ReturnType<typeof useAuthContext>);
    mockedAuthorizedFetch
      .mockResolvedValueOnce(
        jsonResponse({ requests: [buildPendingRequest(1500)] }, { status: 200 })
      )
      .mockResolvedValueOnce(
        jsonResponse({ request: buildPaidRequest() }, { status: 200 })
      )
      .mockResolvedValueOnce(
        jsonResponse({ requests: [buildPaidRequest()] }, { status: 200 })
      );

    renderPanel();

    await screen.findByText("XALP");
    await user.click(screen.getByRole("button", { name: "Confirm" }));
    await user.click(
      await screen.findByRole("button", { name: /confirm payment/i })
    );

    await waitFor(() => {
      expect(mockedAuthorizedFetch).toHaveBeenCalledWith(
        "/api/admin/payment-requests/payment-request-pending/confirm",
        expect.objectContaining({ method: "POST" })
      );
    });
    expect(refreshReservations).toHaveBeenCalled();
    expect(loadBookingDetails).toHaveBeenCalledWith("reservation-1");
    expect(notifyReservationsChanged).toHaveBeenCalledWith({
      reservationId: "reservation-1",
    });
    expect(mockedRevalidateReservationsCache).toHaveBeenCalled();
  });

  it("allows manual QR creation even when the balance is fully paid", async () => {
    const user = userEvent.setup();
    mockedUseAuthContext.mockReturnValue({
      hasPermission: () => false,
    } as unknown as ReturnType<typeof useAuthContext>);
    mockedAuthorizedFetch
      .mockResolvedValueOnce(jsonResponse({ requests: [] }, { status: 200 }))
      .mockResolvedValueOnce(
        jsonResponse({ request: buildPendingRequest(500) }, { status: 201 })
      )
      .mockResolvedValueOnce(
        jsonResponse({ requests: [buildPendingRequest(500)] }, { status: 200 })
      );

    renderPanel({ balanceDue: 0 });

    await screen.findByText("No payment QR created for this reservation.");
    const amountInput = screen.getByLabelText("UPI Gateway Amount");
    const generateButton = screen.getByRole("button", { name: /generate qr/i });

    expect(amountInput).toBeEnabled();
    expect(generateButton).toBeEnabled();

    await user.type(amountInput, "500");
    await user.click(generateButton);

    await waitFor(() => {
      expect(mockedAuthorizedFetch).toHaveBeenCalledWith(
        "/api/admin/payment-requests",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            amount: 500,
            reservationId: "reservation-1",
          }),
        })
      );
    });
  });

  it("refreshes folio data when an existing pending request becomes paid", async () => {
    const user = userEvent.setup();
    const refreshReservations = vi.fn().mockResolvedValue(undefined);
    const loadBookingDetails = vi.fn().mockResolvedValue(undefined);
    const notifyReservationsChanged = vi.fn();
    const pendingRequest = buildPendingRequest(1);
    const paidRequest = {
      ...pendingRequest,
      folioItemId: "folio-second-payment",
      paidAmount: 1,
      status: "paid",
      paidAt: "2026-05-24T08:15:00.000Z",
      paymentReference: "SW-3Y2AN",
      updatedAt: "2026-05-24T08:15:00.000Z",
    } satisfies PaymentRequest;

    mockedUseDataContext.mockReturnValue({
      refreshReservations,
      loadBookingDetails,
      notifyReservationsChanged,
    } as unknown as ReturnType<typeof useDataContext>);
    mockedUseAuthContext.mockReturnValue({
      hasPermission: () => false,
    } as unknown as ReturnType<typeof useAuthContext>);
    mockedAuthorizedFetch
      .mockResolvedValueOnce(
        jsonResponse({ requests: [pendingRequest] }, { status: 200 })
      )
      .mockResolvedValueOnce(
        jsonResponse({ requests: [paidRequest] }, { status: 200 })
      );

    renderPanel();

    await screen.findByText("XALP");
    await user.click(screen.getByRole("button", { name: /refresh/i }));

    await waitFor(() => {
      expect(mockedRevalidateReservationsCache).toHaveBeenCalled();
    });
    expect(refreshReservations).toHaveBeenCalled();
    expect(loadBookingDetails).toHaveBeenCalledWith("reservation-1");
    expect(notifyReservationsChanged).toHaveBeenCalledWith({
      reservationId: "reservation-1",
    });
  });

  it("does not refresh reservation data when paid requests are unchanged", async () => {
    const user = userEvent.setup();
    const refreshReservations = vi.fn().mockResolvedValue(undefined);
    const loadBookingDetails = vi.fn().mockResolvedValue(undefined);
    const paidRequest = buildPaidRequest();

    mockedUseDataContext.mockReturnValue({
      refreshReservations,
      loadBookingDetails,
      notifyReservationsChanged: vi.fn(),
    } as unknown as ReturnType<typeof useDataContext>);
    mockedUseAuthContext.mockReturnValue({
      hasPermission: () => false,
    } as unknown as ReturnType<typeof useAuthContext>);
    mockedAuthorizedFetch
      .mockResolvedValueOnce(
        jsonResponse({ requests: [paidRequest] }, { status: 200 })
      )
      .mockResolvedValueOnce(
        jsonResponse({ requests: [paidRequest] }, { status: 200 })
      );

    renderPanel();

    await screen.findByText("UPI123");
    await user.click(screen.getByRole("button", { name: /refresh/i }));

    await waitFor(() => {
      expect(mockedAuthorizedFetch).toHaveBeenCalledTimes(2);
    });
    expect(mockedRevalidateReservationsCache).not.toHaveBeenCalled();
    expect(refreshReservations).not.toHaveBeenCalled();
    expect(loadBookingDetails).not.toHaveBeenCalled();
  });

  it("refreshes folio data when a paid request receives a folio item id", async () => {
    const user = userEvent.setup();
    const refreshReservations = vi.fn().mockResolvedValue(undefined);
    const loadBookingDetails = vi.fn().mockResolvedValue(undefined);
    const notifyReservationsChanged = vi.fn();
    const paidWithoutFolio = {
      ...buildPaidRequest(),
      folioItemId: null,
    } satisfies PaymentRequest;
    const paidWithFolio = {
      ...paidWithoutFolio,
      folioItemId: "folio-payment-1",
    } satisfies PaymentRequest;

    mockedUseDataContext.mockReturnValue({
      refreshReservations,
      loadBookingDetails,
      notifyReservationsChanged,
    } as unknown as ReturnType<typeof useDataContext>);
    mockedUseAuthContext.mockReturnValue({
      hasPermission: () => false,
    } as unknown as ReturnType<typeof useAuthContext>);
    mockedAuthorizedFetch
      .mockResolvedValueOnce(
        jsonResponse({ requests: [paidWithoutFolio] }, { status: 200 })
      )
      .mockResolvedValueOnce(
        jsonResponse({ requests: [paidWithFolio] }, { status: 200 })
      );

    renderPanel();

    await screen.findByText("UPI123");
    await user.click(screen.getByRole("button", { name: /refresh/i }));

    await waitFor(() => {
      expect(mockedRevalidateReservationsCache).toHaveBeenCalled();
    });
    expect(refreshReservations).toHaveBeenCalled();
    expect(loadBookingDetails).toHaveBeenCalledWith("reservation-1");
    expect(notifyReservationsChanged).toHaveBeenCalledWith({
      reservationId: "reservation-1",
    });
  });
});

function renderPanel(options: { balanceDue?: number } = {}) {
  render(
    <ReservationPaymentRequestsPanel
      reservationId="reservation-1"
      guest={null}
      balanceDue={options.balanceDue ?? 1500}
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
    statementCode: "KJRM",
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

function buildPendingRequest(amount: number): PaymentRequest {
  return {
    ...buildPaidRequest(),
    id: "payment-request-pending",
    identifier: "XAL6S",
    statementCode: "XALP",
    folioItemId: null,
    amount,
    paidAmount: 0,
    status: "pending",
    paidAt: null,
    paymentReference: null,
    updatedAt: "2026-05-24T08:00:00.000Z",
  };
}

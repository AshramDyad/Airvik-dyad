import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

import PublicReservationPaymentPage from "./page";

const originalUserAgent = navigator.userAgent;

vi.mock("next/navigation", () => ({
  useParams: () => ({ token: "REQ-123" }),
  notFound: vi.fn(),
}));

const setNavigatorUserAgent = (value: string) => {
  Object.defineProperty(window.navigator, "userAgent", {
    configurable: true,
    get: () => value,
  });
};

const resetNavigatorUserAgent = () => {
  Object.defineProperty(window.navigator, "userAgent", {
    configurable: true,
    get: () => originalUserAgent,
  });
};

const createJsonResponse = (body: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  });

const mockPaymentRequest = {
  data: {
    request: {
      id: "req-1",
      token: "REQ-123",
      reservationIds: ["res-1"],
      amount: 3000,
      paidAmount: 500,
      status: "requested",
      requestedAt: "2025-01-01T10:00:00.000Z",
      paymentMethod: "UPI",
      expiresAt: "2099-12-31T23:59:59.999Z",
      createdAt: "2025-01-01T10:00:00.000Z",
      updatedAt: "2025-01-01T10:00:00.000Z",
    },
    property: {
      id: "prop-1",
      name: "Hotel Royal",
      currency: "INR",
      upiId: "hotel@upi",
      upiMerchantName: "Hotel Royal",
    },
    reservations: [
      {
        reservationId: "res-1",
        bookingId: "BK-1001",
        checkInDate: "2025-01-05",
        checkOutDate: "2025-01-07",
        guestName: "Alex Guest",
        guestEmail: "alex@example.com",
        guestPhone: "+91 9000000000",
      },
    ],
  },
};

describe("PublicReservationPaymentPage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    resetNavigatorUserAgent();
  });

  const setupClipboard = () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      writable: true,
      value: { writeText },
    });
    return writeText;
  };

  it("renders loading then payment request details", async () => {
    setNavigatorUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)");
    setupClipboard();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(createJsonResponse(mockPaymentRequest))
    );

    render(<PublicReservationPaymentPage />);

    expect(screen.getByText(/Loading payment request/i)).toBeInTheDocument();

    await waitFor(() => {
    expect(screen.getByText(/Reservation payment/i)).toBeInTheDocument();
  });

    expect(screen.getByText(/Request Amount/i)).toBeInTheDocument();
    expect(screen.getByText(/Copy payment page link/i)).toBeInTheDocument();
    expect(
      screen.getByText(/On iOS and other devices/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/Booking and guest details/i)).toBeInTheDocument();
    expect(screen.getByText(/Alex Guest/i)).toBeInTheDocument();
    expect(screen.getByText(/BK-1001/i)).toBeInTheDocument();
  });

  it("shows Android intent label when user agent is Android", async () => {
    setNavigatorUserAgent("Mozilla/5.0 (Linux; Android 12; Pixel 5)");
    setupClipboard();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(createJsonResponse(mockPaymentRequest))
    );

    render(<PublicReservationPaymentPage />);

    await waitFor(() => {
      expect(screen.getByText(/Reservation payment/i)).toBeInTheDocument();
    });

    expect(
      screen.getByText(/On Android, use the UPI button below/i)
    ).toBeInTheDocument();
    const actionButton = screen.getByRole("button", {
      name: /Share intent link/i,
    });
    expect(actionButton).toBeInTheDocument();
  });

  it("renders error state when token lookup fails", async () => {
    setNavigatorUserAgent("Mozilla/5.0 (Windows NT 10.0)");
    setupClipboard();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ message: "Reservation request not found." }),
          {
            status: 404,
            headers: { "content-type": "application/json" },
          }
        )
      )
    );

    render(<PublicReservationPaymentPage />);

    await waitFor(() => {
      expect(
        screen.getByText(/Reservation request not found\./i)
      ).toBeInTheDocument();
    });
  });

  it("shows UPI unavailable state when property UPI id is missing", async () => {
    setupClipboard();
    const noUpiRequest = {
      ...mockPaymentRequest,
      data: {
        ...mockPaymentRequest.data,
        property: {
          ...mockPaymentRequest.data.property,
          upiId: undefined,
        },
      },
    };

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(createJsonResponse(noUpiRequest))
    );

    render(<PublicReservationPaymentPage />);

    await waitFor(() => {
      expect(
        screen.getByText(/Reservation payment/i)
      ).toBeInTheDocument();
    });

    expect(
      screen.getByText(/UPI is not available for this property at the moment\./i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Copy payment page link/i })
    ).toBeInTheDocument();
  });
});

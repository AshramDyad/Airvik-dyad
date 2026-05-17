import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { ReservationWithDetails } from "@/app/admin/reservations/components/columns";
import { BillingCard } from "@/app/admin/reservations/[id]/components/BillingCard";
import { ReservationPaymentRequest } from "@/data/types";

type DataContextState = {
  property: {
    id: string;
    name: string;
    address: string;
    phone: string;
    email: string;
    logo_url: string;
    photos: string[];
    google_maps_url: string;
    timezone: string;
    currency: string;
    allowSameDayTurnover: boolean;
    showPartialDays: boolean;
    defaultUnitsView: "remaining" | "booked";
    tax_enabled: boolean;
    tax_percentage: number;
    upi_id?: string;
    upi_merchant_name?: string | null;
  };
  reservationPaymentRequests: ReservationPaymentRequest[];
  loadReservationPaymentRequests: ReturnType<typeof vi.fn>;
  createReservationPaymentRequest: ReturnType<typeof vi.fn>;
  updateReservationPaymentRequest: ReturnType<typeof vi.fn>;
  applyManualPaymentToReservationPaymentRequests: ReturnType<typeof vi.fn>;
  addFolioItem: ReturnType<typeof vi.fn>;
};

let contextState: DataContextState = null as unknown as DataContextState;

vi.mock("@/context/data-context", () => ({
  useDataContext: () => contextState,
}));

vi.mock("@/app/admin/reservations/components/record-payment-dialog", () => ({
  RecordPaymentDialog: ({ children }: { children: React.ReactNode }) => (
    <span>{children}</span>
  ),
}));

vi.mock("@/app/admin/reservations/components/add-charge-dialog", () => ({
  AddChargeDialog: ({ children }: { children: React.ReactNode }) => (
    <span>{children}</span>
  ),
}));

const baseProperty = {
  id: "property-1",
  name: "Hotel Sample",
  address: "Main Street",
  phone: "1111111111",
  email: "hotel@example.com",
  logo_url: "",
  photos: [],
  google_maps_url: "",
  timezone: "Asia/Kolkata",
  currency: "INR",
  allowSameDayTurnover: true,
  showPartialDays: true,
  defaultUnitsView: "remaining" as const,
  tax_enabled: false,
  tax_percentage: 0,
  upi_id: "hotel@upi",
  upi_merchant_name: "Hotel Sample",
};

const reservation: ReservationWithDetails = {
  id: "res-1",
  bookingId: "BK-1001",
  guestId: "guest-1",
  roomId: "room-1",
  roomNumber: "101",
  ratePlanId: null,
  checkInDate: "2025-01-05",
  checkOutDate: "2025-01-07",
  numberOfGuests: 2,
  status: "Confirmed",
  notes: "",
  folio: [],
  totalAmount: 1000,
  bookingDate: "2025-01-01T10:00:00.000Z",
  source: "reception",
  paymentMethod: "Cash",
  adultCount: 2,
  childCount: 0,
  taxEnabledSnapshot: false,
  taxRateSnapshot: 0,
  guestName: "Jane Guest",
  nights: 2,
};

const groupSummary = {
  reservations: [reservation],
  roomCount: 1,
  totalAmount: 1000,
  folio: [],
  taxesTotal: 0,
  hasMixedTaxRates: false,
  appliedTaxRate: 0,
};

describe("BillingCard", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("creates payment request in amount mode", async () => {
    const user = userEvent.setup();
    const createReservationPaymentRequest = vi.fn().mockResolvedValue({
      id: "req-1",
      token: "REQ-1",
      reservationIds: ["res-1"],
      amount: 300,
      paidAmount: 0,
      status: "requested",
      requestedAt: "2025-01-01T00:00:00.000Z",
      paymentMethod: "UPI",
      createdAt: "2025-01-01T00:00:00.000Z",
      updatedAt: "2025-01-01T00:00:00.000Z",
    });

    contextState = {
      property: baseProperty,
      reservationPaymentRequests: [],
      loadReservationPaymentRequests: vi.fn().mockResolvedValue([]),
      createReservationPaymentRequest,
      updateReservationPaymentRequest: vi.fn(),
      applyManualPaymentToReservationPaymentRequests: vi.fn(),
      addFolioItem: vi.fn(),
    };

    render(
      <BillingCard
        reservation={reservation}
        groupSummary={groupSummary}
      />
    );

    const amountInput = screen.getByRole("spinbutton", { name: /Amount/i });
    await user.clear(amountInput);
    await user.type(amountInput, "300.00");
    await user.click(screen.getByRole("button", { name: /Create request/i }));

    expect(createReservationPaymentRequest).toHaveBeenCalledWith(expect.objectContaining({
      reservationIds: ["res-1"],
      amount: 300,
      paymentMethod: "UPI",
    }));
  });

  it("calculates percentage request amount", async () => {
    const user = userEvent.setup();
    contextState = {
      property: baseProperty,
      reservationPaymentRequests: [],
      loadReservationPaymentRequests: vi.fn().mockResolvedValue([]),
      createReservationPaymentRequest: vi.fn().mockResolvedValue({
        id: "req-2",
        token: "REQ-2",
        reservationIds: ["res-1"],
        amount: 500,
        paidAmount: 0,
        status: "requested",
        requestedAt: "2025-01-01T00:00:00.000Z",
        paymentMethod: "UPI",
        createdAt: "2025-01-01T00:00:00.000Z",
        updatedAt: "2025-01-01T00:00:00.000Z",
      }),
      updateReservationPaymentRequest: vi.fn(),
      applyManualPaymentToReservationPaymentRequests: vi.fn(),
      addFolioItem: vi.fn(),
    };

    render(
      <BillingCard
        reservation={reservation}
        groupSummary={groupSummary}
      />
    );

    await user.click(screen.getByRole("radio", { name: /Percentage/i }));
    const percentInput = screen.getByRole("spinbutton", { name: /Percentage/i });
    await user.clear(percentInput);
    await user.type(percentInput, "50");
    await user.click(screen.getByRole("button", { name: /Create request/i }));

    expect(contextState.createReservationPaymentRequest).toHaveBeenCalled();
    expect(contextState.createReservationPaymentRequest).toHaveBeenLastCalledWith(
      expect.objectContaining({
        reservationIds: ["res-1"],
        amount: 500,
        paymentMethod: "UPI",
      })
    );
  });

  it("confirms manual payment and updates folio and request reference", async () => {
    const user = userEvent.setup();
    const addFolioItem = vi.fn().mockResolvedValue(undefined);
    const applyManualPaymentToReservationPaymentRequests = vi
      .fn()
      .mockResolvedValue(150);
    const updateReservationPaymentRequest = vi.fn().mockResolvedValue({
      id: "req-3",
      token: "REQ-3",
      reservationIds: ["res-1"],
      amount: 500,
      paidAmount: 150,
      status: "partially_paid",
      requestedAt: "2025-01-01T00:00:00.000Z",
      paymentMethod: "UPI",
      createdAt: "2025-01-01T00:00:00.000Z",
      updatedAt: "2025-01-01T00:00:00.000Z",
    });

    contextState = {
      property: baseProperty,
      reservationPaymentRequests: [
        {
          id: "req-3",
          token: "REQ-3",
          reservationIds: ["res-1"],
          amount: 500,
          paidAmount: 50,
          status: "requested",
          requestedAt: "2025-01-01T00:00:00.000Z",
          paymentMethod: "UPI",
          createdAt: "2025-01-01T00:00:00.000Z",
          updatedAt: "2025-01-01T00:00:00.000Z",
        },
      ],
      loadReservationPaymentRequests: vi.fn().mockResolvedValue([]),
      createReservationPaymentRequest: vi.fn(),
      updateReservationPaymentRequest,
      applyManualPaymentToReservationPaymentRequests,
      addFolioItem,
    };

    render(
      <BillingCard
        reservation={reservation}
        groupSummary={groupSummary}
      />
    );

    const amountField = document.getElementById("manual-payment-amount-req-3");
    const referenceField = document.getElementById("manual-payment-reference-req-3");

    expect(amountField).toBeInTheDocument();
    expect(referenceField).toBeInTheDocument();

    await user.clear(amountField as HTMLInputElement);
    await user.type(amountField as HTMLInputElement, "150");
    await user.clear(referenceField as HTMLInputElement);
    await user.type(referenceField as HTMLInputElement, "TXN-150");
    await user.click(screen.getByRole("button", { name: /Confirm manual payment/i }));

    expect(addFolioItem).toHaveBeenCalledWith(
      "res-1",
      {
        description: "Manual payment for request #REQ-3",
        amount: -150,
        paymentMethod: "Manual",
        transactionId: "TXN-150",
      },
      { autoApplyToReservationPaymentRequests: false }
    );
    expect(
      applyManualPaymentToReservationPaymentRequests
    ).toHaveBeenCalledWith("res-1", 150, { requestIds: ["req-3"] });
    expect(updateReservationPaymentRequest).toHaveBeenCalledWith(
      "req-3",
      { paymentReference: "TXN-150" }
    );
  });

  it("shows UPI configuration warning when property UPI id is missing", () => {
    contextState = {
      property: {
        ...baseProperty,
        upi_id: undefined,
      },
      reservationPaymentRequests: [
        {
          id: "req-4",
          token: "REQ-4",
          reservationIds: ["res-1"],
          amount: 500,
          paidAmount: 0,
          status: "requested",
          requestedAt: "2025-01-01T00:00:00.000Z",
          paymentMethod: "UPI",
          createdAt: "2025-01-01T00:00:00.000Z",
          updatedAt: "2025-01-01T00:00:00.000Z",
        },
      ],
      loadReservationPaymentRequests: vi.fn().mockResolvedValue([]),
      createReservationPaymentRequest: vi.fn(),
      updateReservationPaymentRequest: vi.fn(),
      applyManualPaymentToReservationPaymentRequests: vi.fn(),
      addFolioItem: vi.fn(),
    };

    render(
      <BillingCard
        reservation={reservation}
        groupSummary={groupSummary}
      />
    );

    expect(
      screen.getByText(/UPI is not configured for this property/i)
    ).toBeInTheDocument();
  });
});

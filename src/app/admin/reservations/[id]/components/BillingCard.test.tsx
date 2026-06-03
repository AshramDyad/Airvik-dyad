import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useDataContext } from "@/context/data-context";
import type { ReservationWithDetails } from "@/app/admin/reservations/components/columns";
import {
  buildFolioItem,
  buildGuest,
  buildReservation,
  resetBuilderSequences,
} from "@/test/builders";
import { BillingCard } from "./BillingCard";

vi.mock("@/context/data-context", () => ({
  useDataContext: vi.fn(),
}));

vi.mock("@/hooks/use-currency", () => ({
  useCurrencyFormatter: () => (value: number) => `₹${value.toFixed(2)}`,
  useWholeCurrencyFormatter: () => (value: number) => `₹${Math.round(value)}`,
}));

vi.mock("@/app/admin/reservations/components/add-charge-dialog", () => ({
  AddChargeDialog: ({ children }: { children: ReactNode }) => children,
}));

vi.mock("@/app/admin/reservations/components/record-payment-dialog", () => ({
  RecordPaymentDialog: ({ children }: { children: ReactNode }) => children,
}));

vi.mock("./ReservationPaymentRequestsPanel", () => ({
  ReservationPaymentRequestsPanel: () => (
    <div data-testid="payment-requests-panel">Payment QR panel</div>
  ),
}));

const mockedUseDataContext = vi.mocked(useDataContext);

describe("BillingCard", () => {
  beforeEach(() => {
    resetBuilderSequences();
  });

  it("keeps payment QR visible for fully paid legacy reservations", () => {
    const guest = buildGuest({ id: "guest-1" });
    const reservation = toReservationDetails({
      guestId: guest.id,
      paymentMethod: "Not specified",
      totalAmount: 100,
      folio: [
        buildFolioItem({
          amount: -100,
          paymentMethod: "Cash",
        }),
      ],
    });
    mockedUseDataContext.mockReturnValue({
      guests: [guest],
      property: {
        currency: "INR",
        logo_url: "/logo.png",
        tax_enabled: false,
        tax_percentage: 0,
      },
    } as unknown as ReturnType<typeof useDataContext>);

    render(<BillingCard reservation={reservation} groupSummary={emptyGroupSummary()} />);

    expect(screen.getByTestId("payment-requests-panel")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Record Payment" })).toBeInTheDocument();
  });

  it("shows cash recording alongside the payment QR for gateway reservations", () => {
    const guest = buildGuest({ id: "guest-1" });
    const reservation = toReservationDetails({
      guestId: guest.id,
      paymentMethod: "UPI Gateway",
      totalAmount: 100,
      folio: [],
    });
    mockedUseDataContext.mockReturnValue({
      guests: [guest],
      property: {
        currency: "INR",
        logo_url: "/logo.png",
        tax_enabled: false,
        tax_percentage: 0,
      },
    } as unknown as ReturnType<typeof useDataContext>);

    render(<BillingCard reservation={reservation} groupSummary={emptyGroupSummary()} />);

    expect(screen.getByTestId("payment-requests-panel")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Record Payment" })).toBeInTheDocument();
  });
});

function toReservationDetails(
  overrides: Parameters<typeof buildReservation>[0]
): ReservationWithDetails {
  return {
    ...buildReservation(overrides),
    guestName: "Test Guest",
    roomNumber: "101",
    nights: 1,
  };
}

function emptyGroupSummary() {
  return {
    reservations: [],
    roomCount: 0,
    totalAmount: 0,
    folio: [],
    taxesTotal: 0,
    hasMixedTaxRates: false,
    appliedTaxRate: null,
  };
}

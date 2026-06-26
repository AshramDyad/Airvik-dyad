import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useDataContext } from "@/context/data-context";
import { authorizedFetch } from "@/lib/auth/client-session";
import { RecordPaymentDialog } from "./record-payment-dialog";

vi.mock("@/context/data-context", () => ({
  useDataContext: vi.fn(),
}));

vi.mock("@/lib/auth/client-session", () => ({
  authorizedFetch: vi.fn(),
}));

vi.mock("@/hooks/use-currency", () => ({
  useCurrencyFormatter: () => (value: number) => `₹${value.toFixed(2)}`,
}));

const mockedUseDataContext = vi.mocked(useDataContext);
const mockedAuthorizedFetch = vi.mocked(authorizedFetch);

// The dialog reads booking financials from props, not from the context list.
// Mock the context with an EMPTY `reservations` array so these tests double as a
// regression guard: a booking absent from the capped in-memory list must still pay.
function mockContext() {
  const refreshReservations = vi.fn().mockResolvedValue(undefined);
  const loadBookingDetails = vi.fn().mockResolvedValue(undefined);
  const notifyReservationsChanged = vi.fn();

  mockedUseDataContext.mockReturnValue({
    reservations: [],
    refreshReservations,
    loadBookingDetails,
    notifyReservationsChanged,
  } as unknown as ReturnType<typeof useDataContext>);

  return { refreshReservations, loadBookingDetails, notifyReservationsChanged };
}

describe("RecordPaymentDialog", () => {
  beforeEach(() => {
    mockedAuthorizedFetch.mockResolvedValue(
      new Response(JSON.stringify({ folioItem: { id: "folio-1" } }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      })
    );
  });

  it("records cash through the cash-payment API route for any booking, even one missing from the context list", async () => {
    const user = userEvent.setup();
    const { refreshReservations, loadBookingDetails, notifyReservationsChanged } =
      mockContext();

    render(
      <RecordPaymentDialog
        reservationId="reservation-1"
        billingSource={{ totalAmount: 100, folio: [] }}
        taxConfig={{ enabled: false, percentage: 0 }}
      >
        <button type="button">Open cash dialog</button>
      </RecordPaymentDialog>
    );

    await user.click(screen.getByRole("button", { name: "Open cash dialog" }));
    await user.clear(screen.getByLabelText("Amount"));
    await user.type(screen.getByLabelText("Amount"), "100");
    await user.click(screen.getByRole("button", { name: "Record Cash" }));

    await waitFor(() => {
      expect(mockedAuthorizedFetch).toHaveBeenCalledWith(
        "/api/admin/reservations/reservation-1/cash-payment",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ amount: 100, notes: "" }),
        })
      );
    });
    expect(refreshReservations).toHaveBeenCalled();
    expect(loadBookingDetails).toHaveBeenCalledWith("reservation-1");
    expect(notifyReservationsChanged).toHaveBeenCalledWith({
      reservationId: "reservation-1",
    });
  });

  it("forwards the optional remark in the request body", async () => {
    const user = userEvent.setup();
    mockContext();

    render(
      <RecordPaymentDialog
        reservationId="reservation-1"
        billingSource={{ totalAmount: 100, folio: [] }}
        taxConfig={{ enabled: false, percentage: 0 }}
      >
        <button type="button">Open cash dialog</button>
      </RecordPaymentDialog>
    );

    await user.click(screen.getByRole("button", { name: "Open cash dialog" }));
    await user.clear(screen.getByLabelText("Amount"));
    await user.type(screen.getByLabelText("Amount"), "100");
    await user.type(
      screen.getByLabelText("Remarks (optional)"),
      "Paid at front desk"
    );
    await user.click(screen.getByRole("button", { name: "Record Cash" }));

    await waitFor(() => {
      expect(mockedAuthorizedFetch).toHaveBeenCalledWith(
        "/api/admin/reservations/reservation-1/cash-payment",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ amount: 100, notes: "Paid at front desk" }),
        })
      );
    });
  });
});

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useDataContext } from "@/context/data-context";
import { authorizedFetch } from "@/lib/auth/client-session";
import { buildReservation, resetBuilderSequences } from "@/test/builders";
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

describe("RecordPaymentDialog", () => {
  beforeEach(() => {
    resetBuilderSequences();
    mockedAuthorizedFetch.mockResolvedValue(
      new Response(JSON.stringify({ folioItem: { id: "folio-1" } }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      })
    );
  });

  it("records cash through the cash-payment API route", async () => {
    const user = userEvent.setup();
    const reservation = buildReservation({
      id: "reservation-1",
      totalAmount: 100,
      folio: [],
    });
    const refreshReservations = vi.fn().mockResolvedValue(undefined);
    const loadBookingDetails = vi.fn().mockResolvedValue(undefined);
    const notifyReservationsChanged = vi.fn();

    mockedUseDataContext.mockReturnValue({
      reservations: [reservation],
      property: { tax_enabled: false, tax_percentage: 0 },
      refreshReservations,
      loadBookingDetails,
      notifyReservationsChanged,
    } as unknown as ReturnType<typeof useDataContext>);

    render(
      <RecordPaymentDialog reservationId="reservation-1">
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
          body: JSON.stringify({ amount: 100 }),
        })
      );
    });
    expect(refreshReservations).toHaveBeenCalled();
    expect(loadBookingDetails).toHaveBeenCalledWith("reservation-1");
    expect(notifyReservationsChanged).toHaveBeenCalledWith({
      reservationId: "reservation-1",
    });
  });
});

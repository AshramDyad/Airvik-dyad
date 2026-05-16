import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { RecordPaymentDialog } from "./record-payment-dialog";

const dataContextMock = vi.hoisted(() => ({
  addFolioItem: vi.fn(),
  useDataContext: vi.fn(),
}));

const toastMock = vi.hoisted(() => ({
  error: vi.fn(),
  success: vi.fn(),
}));

vi.mock("@/context/data-context", () => ({
  useDataContext: dataContextMock.useDataContext,
}));

vi.mock("sonner", () => ({
  toast: toastMock,
}));

beforeAll(() => {
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = () => false;
  }
  if (!Element.prototype.setPointerCapture) {
    Element.prototype.setPointerCapture = () => undefined;
  }
  if (!Element.prototype.releasePointerCapture) {
    Element.prototype.releasePointerCapture = () => undefined;
  }
});

const chooseSelectOption = (optionName: string) => {
  fireEvent.pointerDown(screen.getByRole("combobox"), {
    button: 0,
    ctrlKey: false,
    pointerType: "mouse",
  });
  fireEvent.click(screen.getByRole("option", { name: optionName }));
};

describe("RecordPaymentDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dataContextMock.addFolioItem.mockResolvedValue(undefined);
    dataContextMock.useDataContext.mockReturnValue({
      addFolioItem: dataContextMock.addFolioItem,
      reservations: [],
      property: {
        currency: "INR",
        tax_enabled: false,
        tax_percentage: 0,
      },
    });
  });

  it("records a payment from the provided billing source without global reservations", async () => {
    render(
      <RecordPaymentDialog
        reservationId="reservation-1"
        billingSource={{ folio: [], totalAmount: 1000 }}
        taxConfig={{ enabled: false, percentage: 0 }}
      >
        <button type="button">Open payment dialog</button>
      </RecordPaymentDialog>,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Open payment dialog" }),
    );

    const dialog = screen.getByRole("dialog", { name: "Record Payment" });
    fireEvent.change(within(dialog).getByLabelText("Amount"), {
      target: { value: "250" },
    });
    chooseSelectOption("Cash");

    fireEvent.click(
      within(dialog).getByRole("button", { name: "Record Payment" }),
    );

    await waitFor(() =>
      expect(dataContextMock.addFolioItem).toHaveBeenCalledWith(
        "reservation-1",
        {
          description: "Payment - Cash",
          amount: -250,
          paymentMethod: "Cash",
          transactionId: undefined,
        },
      ),
    );
    expect(toastMock.error).not.toHaveBeenCalledWith("Reservation not found.");
  });
});

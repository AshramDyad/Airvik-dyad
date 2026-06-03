import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useAuthContext } from "@/context/auth-context";
import { useDataContext } from "@/context/data-context";
import type { GoogleSheetTransaction, Permission } from "@/data/types";
import { authorizedFetch } from "@/lib/auth/client-session";
import type { StatementBookingLink } from "@/lib/payments/statement-links";
import { PaymentsClient } from "./payments-client";

vi.mock("@/context/auth-context", () => ({
  useAuthContext: vi.fn(),
}));

vi.mock("@/context/data-context", () => ({
  useDataContext: vi.fn(),
}));

vi.mock("@/lib/auth/client-session", () => ({
  authorizedFetch: vi.fn(),
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

describe("PaymentsClient", () => {
  beforeEach(() => {
    mockedAuthorizedFetch.mockReset();
    mockedUseDataContext.mockReturnValue({
      property: { currency: "INR", timezone: "Asia/Kolkata" },
    } as unknown as ReturnType<typeof useDataContext>);
    mockedUseAuthContext.mockReturnValue({
      hasPermission: (permission: Permission) => permission === "update:payment",
    } as unknown as ReturnType<typeof useAuthContext>);
  });

  it("renders a clickable booking link for a matched transaction", async () => {
    mockFetch({
      rows: [buildTransaction({ reference: "UTR-1" })],
      links: [
        { reference: "UTR-1", reservationId: "res-1", bookingId: "A100001" },
      ],
    });

    render(<PaymentsClient />);

    const link = await screen.findByRole("link", { name: "A100001" });
    expect(link).toHaveAttribute("href", "/admin/reservations/res-1");
    expect(
      screen.queryByRole("button", { name: "Attach" })
    ).not.toBeInTheDocument();
  });

  it("shows an Attach button for an unmatched transaction and posts the attach", async () => {
    const user = userEvent.setup();
    mockFetch({
      rows: [buildTransaction({ reference: "UTR-2", amount: 2500 })],
      links: [],
    });

    render(<PaymentsClient />);

    const attachButton = await screen.findByRole("button", { name: "Attach" });
    await user.click(attachButton);

    const input = await screen.findByLabelText("Booking id");
    await user.type(input, "A100001");
    await user.click(screen.getByRole("button", { name: /attach booking/i }));

    await waitFor(() => {
      expect(mockedAuthorizedFetch).toHaveBeenCalledWith(
        "/api/admin/payment-statement/attach",
        expect.objectContaining({ method: "POST" })
      );
    });

    const attachCall = mockedAuthorizedFetch.mock.calls.find(
      ([url]) => url === "/api/admin/payment-statement/attach"
    );
    const requestBody = JSON.parse(
      (attachCall?.[1]?.body as string | undefined) ?? "{}"
    );
    expect(requestBody).toEqual({
      bookingId: "A100001",
      amount: 2500,
      reference: "UTR-2",
    });
  });
});

function mockFetch(options: {
  rows: GoogleSheetTransaction[];
  links: StatementBookingLink[];
}) {
  mockedAuthorizedFetch.mockImplementation((input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();

    if (url.startsWith("/api/admin/google-sheet-transactions")) {
      return Promise.resolve(
        jsonResponse({ rows: options.rows, fetchedAt: "2026-06-03T10:00:00.000Z" })
      );
    }
    if (url.startsWith("/api/admin/payment-statement/links")) {
      return Promise.resolve(jsonResponse({ links: options.links }));
    }
    if (url.startsWith("/api/admin/payment-statement/attach")) {
      return Promise.resolve(jsonResponse({ reservationId: "res-1" }, { status: 201 }));
    }
    // reconcile + anything else
    return Promise.resolve(jsonResponse({}));
  });
}

function buildTransaction(
  overrides: Partial<GoogleSheetTransaction> = {}
): GoogleSheetTransaction {
  return {
    rowNumber: 1,
    fetchedAt: "2026-06-03T10:00:00.000Z",
    date: "2026-06-03",
    amount: 2000,
    amountText: "2000",
    description: "Test payment",
    payer: "Guest",
    method: "UPI",
    reference: "UTR-1",
    status: "Credit",
    raw: {},
    cells: [],
    ...overrides,
  };
}

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

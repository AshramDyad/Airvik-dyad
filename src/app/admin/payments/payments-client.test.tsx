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
      hasFeatureAccess: (feature: string) => feature === "donationsCreate",
    } as unknown as ReturnType<typeof useAuthContext>);
  });

  it("renders a clickable booking link for a matched transaction", async () => {
    mockFetch({
      rows: [buildTransaction({ reference: "UTR-1" })],
      links: [buildBookingLink({ reference: "UTR-1" })],
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

  it("opens the receipt popup with a Create-new link to the prefilled form", async () => {
    const user = userEvent.setup();
    mockFetch({
      rows: [buildTransaction({ reference: "UTR-3", amount: 1500 })],
      links: [],
    });

    render(<PaymentsClient />);

    const receiptButton = await screen.findByRole("button", { name: "Receipt" });
    await user.click(receiptButton);

    const createLink = await screen.findByRole("link", {
      name: /create new receipt/i,
    });
    const href = createLink.getAttribute("href") ?? "";
    expect(href).toContain("/admin/manual-receipt/new");
    expect(href).toContain("amount=1500");
    expect(href).toContain("transactionId=UTR-3");
    expect(href).toContain("paymentMode=UPI");
    expect(href).toContain("lock=1");
  });

  it("attaches an existing receipt by its slip number", async () => {
    const user = userEvent.setup();
    mockedUseAuthContext.mockReturnValue({
      hasPermission: (permission: Permission) => permission === "update:payment",
      hasFeatureAccess: (feature: string) =>
        feature === "donationsCreate" || feature === "donationsManage",
    } as unknown as ReturnType<typeof useAuthContext>);
    mockFetch({
      rows: [buildTransaction({ reference: "UTR-5", amount: 1500 })],
      links: [],
      receipts: [{ id: "rcpt-5", slipNo: 42, transactionId: null }],
    });

    render(<PaymentsClient />);

    const receiptButton = await screen.findByRole("button", { name: "Receipt" });
    await user.click(receiptButton);

    const input = await screen.findByLabelText("Receipt number");
    await user.type(input, "MR-42");
    await user.click(screen.getByRole("button", { name: /^attach$/i }));

    await waitFor(() => {
      expect(mockedAuthorizedFetch).toHaveBeenCalledWith(
        "/api/admin/manual-receipts/rcpt-5",
        expect.objectContaining({ method: "PATCH" })
      );
    });

    const patchCall = mockedAuthorizedFetch.mock.calls.find(
      ([url]) => url === "/api/admin/manual-receipts/rcpt-5"
    );
    const requestBody = JSON.parse(
      (patchCall?.[1]?.body as string | undefined) ?? "{}"
    );
    expect(requestBody).toEqual({ transactionId: "UTR-5" });
  });

  it("lets an Administration user unattach an attached payment", async () => {
    const user = userEvent.setup();
    mockAdministration();
    mockFetch({
      rows: [buildTransaction({ reference: "UTR-1", amount: 2500 })],
      links: [buildBookingLink({ reference: "UTR-1", folioItemId: "folio-9" })],
    });

    render(<PaymentsClient />);

    const unattachButton = await screen.findByRole("button", {
      name: "Unattach",
    });
    await user.click(unattachButton);
    await user.click(screen.getByRole("button", { name: /yes, delete it/i }));

    await waitFor(() => {
      expect(mockedAuthorizedFetch).toHaveBeenCalledWith(
        "/api/admin/payment-statement/unattach",
        expect.objectContaining({ method: "POST" })
      );
    });

    const unattachCall = mockedAuthorizedFetch.mock.calls.find(
      ([url]) => url === "/api/admin/payment-statement/unattach"
    );
    const requestBody = JSON.parse(
      (unattachCall?.[1]?.body as string | undefined) ?? "{}"
    );
    expect(requestBody).toEqual({ folioItemId: "folio-9" });
  });

  it("hides Unattach for an auto-matched payment even for Administration", async () => {
    mockAdministration();
    mockFetch({
      rows: [buildTransaction({ reference: "UTR-1" })],
      links: [buildBookingLink({ reference: "UTR-1", canUnattach: false })],
    });

    render(<PaymentsClient />);

    await screen.findByRole("link", { name: "A100001" });
    expect(
      screen.queryByRole("button", { name: "Unattach" })
    ).not.toBeInTheDocument();
  });

  it("hides Unattach from a non-Administration role that can attach", async () => {
    mockedUseAuthContext.mockReturnValue({
      hasPermission: (permission: Permission) => permission === "update:payment",
      hasFeatureAccess: (feature: string) => feature === "donationsCreate",
      userRole: { name: "Receptionist" },
    } as unknown as ReturnType<typeof useAuthContext>);
    mockFetch({
      rows: [buildTransaction({ reference: "UTR-1" })],
      links: [buildBookingLink({ reference: "UTR-1" })],
    });

    render(<PaymentsClient />);

    await screen.findByRole("link", { name: "A100001" });
    expect(
      screen.queryByRole("button", { name: "Unattach" })
    ).not.toBeInTheDocument();
  });

  it("renders a clickable slip-no link and hides both buttons when a receipt exists", async () => {
    mockFetch({
      rows: [buildTransaction({ reference: "UTR-4" })],
      links: [],
      receipts: [{ transactionId: "UTR-4", slipNo: 42 }],
    });

    render(<PaymentsClient />);

    const slipLink = await screen.findByRole("link", { name: "MR-42" });
    expect(slipLink).toHaveAttribute("href", "/admin/manual-receipt");
    expect(
      screen.queryByRole("button", { name: "Attach" })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Receipt" })
    ).not.toBeInTheDocument();
  });
});

function mockAdministration() {
  mockedUseAuthContext.mockReturnValue({
    hasPermission: (permission: Permission) => permission === "update:payment",
    hasFeatureAccess: (feature: string) => feature === "donationsCreate",
    userRole: { name: "Administration" },
  } as unknown as ReturnType<typeof useAuthContext>);
}

function buildBookingLink(
  overrides: Partial<StatementBookingLink> = {}
): StatementBookingLink {
  return {
    reference: "UTR-1",
    reservationId: "res-1",
    bookingId: "A100001",
    folioItemId: "folio-1",
    canUnattach: true,
    ...overrides,
  };
}

function mockFetch(options: {
  rows: GoogleSheetTransaction[];
  links: StatementBookingLink[];
  receipts?: Array<{
    id?: string;
    transactionId: string | null;
    slipNo: number;
  }>;
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
    if (url.startsWith("/api/admin/manual-receipts")) {
      return Promise.resolve(jsonResponse({ data: options.receipts ?? [] }));
    }
    if (url.startsWith("/api/admin/payment-statement/attach")) {
      return Promise.resolve(jsonResponse({ reservationId: "res-1" }, { status: 201 }));
    }
    if (url.startsWith("/api/admin/payment-statement/unattach")) {
      return Promise.resolve(jsonResponse({ ok: true, statusReverted: true }));
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

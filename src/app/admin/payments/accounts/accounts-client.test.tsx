import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useDataContext } from "@/context/data-context";
import { authorizedFetch } from "@/lib/auth/client-session";
import { AccountsClient } from "./accounts-client";

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

describe("AccountsClient", () => {
  beforeEach(() => {
    mockedUseDataContext.mockReturnValue({
      property: { timezone: "Asia/Kolkata" },
    } as unknown as ReturnType<typeof useDataContext>);
    mockedAuthorizedFetch.mockReset();
  });

  it("renders daily online, cash, receiver, and transaction totals", async () => {
    mockedAuthorizedFetch.mockResolvedValue(
      new Response(
        JSON.stringify({
          date: "2026-05-24",
          transactions: [
            {
              id: "online-1",
              reservationId: "reservation-1",
              bookingId: "booking-1",
              description: "Payment - UPI Gateway",
              amount: -3000,
              paymentMethod: "UPI Gateway",
              timestamp: "2026-05-24T06:30:00.000Z",
              reference: "UPI-001",
              receivedBy: "user-1",
              receivedByName: "Riya",
              source: "payment_request",
            },
            {
              id: "cash-1",
              reservationId: "reservation-2",
              bookingId: "booking-2",
              description: "Payment - Cash",
              amount: -1200,
              paymentMethod: "Cash",
              timestamp: "2026-05-24T07:30:00.000Z",
              reference: "cash-001",
              receivedBy: "user-2",
              receivedByName: "Karan",
              source: "cash_payment",
            },
          ],
          summary: {
            onlineTotal: 3000,
            onlineCount: 1,
            cashTotal: 1200,
            cashCount: 1,
            total: 4200,
            count: 2,
            cashByReceiver: [
              {
                receivedBy: "user-2",
                receivedByName: "Karan",
                amount: 1200,
                count: 1,
              },
            ],
          },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      )
    );

    render(<AccountsClient />);

    expect(await screen.findAllByText("₹3000.00")).toHaveLength(2);
    expect(screen.getAllByText("₹1200.00")).toHaveLength(3);
    expect(screen.getByText("₹4200.00")).toBeInTheDocument();
    expect(screen.getAllByText("Karan")).toHaveLength(2);
    expect(screen.getByText("booking-2")).toBeInTheDocument();
    expect(screen.getByText("UPI Gateway")).toBeInTheDocument();
    expect(mockedAuthorizedFetch).toHaveBeenCalledWith(
      expect.stringMatching(
        /^\/api\/admin\/accounts\?date=\d{4}-\d{2}-\d{2}&timeZone=Asia%2FKolkata$/
      ),
      { cache: "no-store" }
    );
  });
});

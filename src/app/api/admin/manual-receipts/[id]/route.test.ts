import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  requireFeature: vi.fn(),
  HttpError: class HttpError extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.status = status;
    }
  },
}));
const createServerSupabaseClientMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/server/auth", () => authMocks);
vi.mock("@/integrations/supabase/server", () => ({
  createServerSupabaseClient: createServerSupabaseClientMock,
}));

import { MANUAL_RECEIPT_SELECT_COLUMNS } from "../columns";
import { PATCH } from "./route";

const receiptRow = {
  id: "receipt-1",
  slip_no: 1,
  first_name: "Asha",
  last_name: "Guest",
  full_name: "Asha Guest",
  phone: "9999999999",
  email: null,
  address: null,
  city: null,
  pancard: null,
  aadhar_card: null,
  dob: null,
  amount: 1000,
  payment_method: "Cash",
  transaction_id: null,
  note: null,
  status: "Accepted",
  by_hand: null,
  creator: null,
  img_link: null,
  trust: null,
  donation_type: null,
  donation_in: null,
  payment_mode: null,
  created_at: "2026-05-01T00:00:00.000Z",
};

const createQuery = (response: unknown) => {
  const query = {
    update: vi.fn(() => query),
    eq: vi.fn(() => query),
    select: vi.fn(() => query),
    maybeSingle: vi.fn(async () => response),
  };
  return query;
};

describe("manual receipt detail API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("PATCH returns exact manual receipt columns", async () => {
    const query = createQuery({ data: receiptRow, error: null });
    const supabase = { from: vi.fn(() => query) };
    createServerSupabaseClientMock.mockReturnValue(supabase);

    const response = await PATCH(
      new Request("http://localhost/api/admin/manual-receipts/receipt-1", {
        method: "PATCH",
        body: JSON.stringify({ status: "Accepted" }),
      }),
      { params: Promise.resolve({ id: "receipt-1" }) }
    );

    expect(response.status).toBe(200);
    expect(query.eq).toHaveBeenCalledWith("id", "receipt-1");
    expect(query.select).toHaveBeenCalledWith(MANUAL_RECEIPT_SELECT_COLUMNS);
    expect(query.maybeSingle).toHaveBeenCalledTimes(1);
  });
});

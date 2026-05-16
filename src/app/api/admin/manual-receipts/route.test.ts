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

import { MANUAL_RECEIPT_SELECT_COLUMNS } from "./columns";
import { GET, POST } from "./route";

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
    select: vi.fn(() => query),
    order: vi.fn(() => query),
    insert: vi.fn(() => query),
    single: vi.fn(async () => response),
    then: (resolve: (value: unknown) => unknown) => Promise.resolve(response).then(resolve),
  };
  return query;
};

describe("manual receipts API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("GET uses exact manual receipt columns", async () => {
    const query = createQuery({ data: [receiptRow], error: null });
    const supabase = { from: vi.fn(() => query) };
    createServerSupabaseClientMock.mockReturnValue(supabase);

    const response = await GET(new Request("http://localhost/api/admin/manual-receipts"));

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(query.select).toHaveBeenCalledWith(MANUAL_RECEIPT_SELECT_COLUMNS);
    expect(query.order).toHaveBeenCalledWith("created_at", { ascending: false });
  });

  it("POST returns exact manual receipt columns", async () => {
    const query = createQuery({ data: receiptRow, error: null });
    const supabase = { from: vi.fn(() => query) };
    createServerSupabaseClientMock.mockReturnValue(supabase);

    const response = await POST(
      new Request("http://localhost/api/admin/manual-receipts", {
        method: "POST",
        body: JSON.stringify({
          fullName: "Asha Guest",
          phone: "9999999999",
          amount: 1000,
          paymentMethod: "Cash",
        }),
      })
    );

    expect(response.status).toBe(201);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(query.select).toHaveBeenCalledWith(MANUAL_RECEIPT_SELECT_COLUMNS);
    expect(query.single).toHaveBeenCalledTimes(1);
  });
});

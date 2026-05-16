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
const getServerSupabaseClientMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/server/auth", () => authMocks);
vi.mock("@/lib/server/supabase", () => ({
  getServerSupabaseClient: getServerSupabaseClientMock,
}));

import { ADMIN_FEEDBACK_SELECT_COLUMNS } from "./columns";
import { GET } from "./route";

const createQuery = (response: unknown) => {
  const query = {
    select: vi.fn(() => query),
    order: vi.fn(() => query),
    range: vi.fn(() => query),
    eq: vi.fn(() => query),
    or: vi.fn(() => query),
    gte: vi.fn(() => query),
    lte: vi.fn(() => query),
    then: (resolve: (value: unknown) => unknown) => Promise.resolve(response).then(resolve),
  };
  return query;
};

describe("admin feedback API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses exact feedback columns for paginated admin reads", async () => {
    const query = createQuery({ data: [], error: null, count: 0 });
    const supabase = { from: vi.fn(() => query) };
    getServerSupabaseClientMock.mockResolvedValue(supabase);

    const response = await GET(
      new Request("http://localhost/api/admin/feedback?page=2&pageSize=5&status=new")
    );

    expect(response.status).toBe(200);
    expect(supabase.from).toHaveBeenCalledWith("feedback");
    expect(query.select).toHaveBeenCalledWith(ADMIN_FEEDBACK_SELECT_COLUMNS, {
      count: "exact",
    });
    expect(query.range).toHaveBeenCalledWith(5, 9);
    expect(query.eq).toHaveBeenCalledWith("status", "new");
  });
});

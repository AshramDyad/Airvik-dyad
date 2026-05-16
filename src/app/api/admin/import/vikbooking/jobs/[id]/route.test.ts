import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  requireAdminProfile: vi.fn(),
  HttpError: class HttpError extends Error {
    status: number;

    constructor(message: string, status = 500) {
      super(message);
      this.status = status;
    }
  },
}));
const createServerSupabaseClientMock = vi.hoisted(() => vi.fn());
const jobMocks = vi.hoisted(() => ({
  fetchJobById: vi.fn(),
}));

vi.mock("@/lib/server/auth", () => authMocks);
vi.mock("@/integrations/supabase/server", () => ({
  createServerSupabaseClient: createServerSupabaseClientMock,
}));
vi.mock("@/lib/importers/vikbooking/jobs", () => jobMocks);

import { GET } from "./route";

type QueryState = {
  select?: { columns: string; options?: Record<string, unknown> };
  filters: Array<[string, unknown]>;
  limit?: number;
};

type QueryDouble = {
  __state: QueryState;
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  gt: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  then: (
    resolve: (value: unknown) => unknown,
    reject?: (reason: unknown) => unknown,
  ) => Promise<unknown>;
};

const entryStatusCounts = {
  pending: 3,
  imported: 9,
  skipped: 2,
  error: 1,
};

const statusFilterFor = (state: QueryState) =>
  state.filters.find(([column]) => column === "status")?.[1];

const createSupabaseDouble = () => {
  const queries: QueryDouble[] = [];
  const supabase = {
    from: vi.fn(() => {
      const state: QueryState = { filters: [] };
      const query: QueryDouble = {
        __state: state,
        select: vi.fn((columns: string, options?: Record<string, unknown>) => {
          state.select = { columns, options };
          return query;
        }),
        eq: vi.fn((column: string, value: unknown) => {
          state.filters.push([column, value]);
          return query;
        }),
        gt: vi.fn(() => query),
        order: vi.fn(() => query),
        limit: vi.fn((value: number) => {
          state.limit = value;
          return query;
        }),
        then: (resolve, reject) =>
          Promise.resolve(resolveQueryResponse(state)).then(resolve, reject),
      };
      queries.push(query);
      return query;
    }),
  };

  return { supabase, queries };
};

function resolveQueryResponse(state: QueryState) {
  const status = statusFilterFor(state);
  if (state.select?.options?.head === true) {
    return {
      data: null,
      error: null,
      count:
        typeof status === "string"
          ? entryStatusCounts[status as keyof typeof entryStatusCounts] ?? 0
          : 0,
    };
  }

  if (status === "error") {
    return {
      data: [{ id: "entry-error-1", row_number: 7, message: "Invalid stay" }],
      error: null,
    };
  }

  if (status === "skipped") {
    return { data: [], error: null };
  }

  return {
    data: [
      { id: "entry-1", status: "pending", row_number: 1, message: null },
      { id: "entry-2", status: "error", row_number: 7, message: "Invalid stay" },
    ],
    error: null,
  };
}

describe("VikBooking import job status API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.requireAdminProfile.mockResolvedValue({ userId: "admin-1" });
    jobMocks.fetchJobById.mockResolvedValue({
      id: "job-1",
      source: "vikbooking",
      status: "running",
      totalRows: 15,
      processedRows: 4,
      errorRows: 0,
      summary: {},
      metadata: {},
      createdBy: "admin-1",
      createdAt: "2026-05-14T00:00:00.000Z",
      completedAt: null,
      lastError: null,
    });
  });

  it("returns job status using count-only entry queries and no shared caching", async () => {
    const { supabase, queries } = createSupabaseDouble();
    createServerSupabaseClientMock.mockReturnValue(supabase);
    const skippedEntry = {
      entryId: "entry-skipped-1",
      rowNumber: 3,
      bookingId: "BK-3",
      roomLabel: "Room 3",
      guestName: "Asha Visitor",
      reason: "Booking already imported for Room 3",
      reasonCode: "already_imported",
      skippedAt: "2026-05-14T02:00:00.000Z",
    };
    jobMocks.fetchJobById.mockResolvedValue({
      id: "job-1",
      source: "vikbooking",
      status: "running",
      totalRows: 15,
      processedRows: 4,
      errorRows: 0,
      summary: { skippedRows: [skippedEntry] },
      metadata: {},
      createdBy: "admin-1",
      createdAt: "2026-05-14T00:00:00.000Z",
      completedAt: null,
      lastError: null,
    });

    const response = await GET(
      new Request("https://airvik.test/api/admin/import/vikbooking/jobs/job-1"),
      { params: Promise.resolve({ id: "job-1" }) },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");

    const payload = await response.json();
    expect(payload.statusCounts).toEqual(entryStatusCounts);
    expect(payload.errors).toEqual([
      { id: "entry-error-1", rowNumber: 7, message: "Invalid stay" },
    ]);
    expect(payload.skippedEntries).toEqual([skippedEntry]);

    for (const status of ["pending", "imported", "skipped", "error"]) {
      expect(
        queries.some(
          (query) =>
            query.__state.select?.columns === "id" &&
            query.__state.select?.options?.count === "exact" &&
            query.__state.select?.options?.head === true &&
            query.__state.filters.some(
              ([column, value]) => column === "status" && value === status,
            ),
        ),
      ).toBe(true);
    }

    expect(
      queries.some(
        (query) => query.__state.select?.columns === "id,status,message,row_number",
      ),
    ).toBe(false);

    const recentErrorQuery = queries.find(
      (query) =>
        query.__state.select?.columns === "id,row_number,message" &&
        query.__state.filters.some(
          ([column, value]) => column === "status" && value === "error",
        ),
    );
    expect(recentErrorQuery?.limit).toHaveBeenCalledWith(10);
    expect(
      queries.some(
        (query) =>
          query.__state.select?.columns ===
          "id,row_number,message,payload,updated_at,skip_reason_code",
      ),
    ).toBe(false);
  });
});

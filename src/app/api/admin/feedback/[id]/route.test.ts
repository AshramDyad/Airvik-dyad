import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  requireFeature: vi.fn(async () => ({
    id: "profile-1",
    name: "Manager",
    role: "manager",
  })),
  HttpError: class HttpError extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.status = status;
    }
  },
}));
const getServerSupabaseClientMock = vi.hoisted(() => vi.fn());
const logAdminActivityFromProfileMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/server/auth", () => authMocks);
vi.mock("@/lib/server/supabase", () => ({
  getServerSupabaseClient: getServerSupabaseClientMock,
}));
vi.mock("@/lib/activity/server", () => ({
  logAdminActivityFromProfile: logAdminActivityFromProfileMock,
}));

import { PATCH } from "./route";
import { ADMIN_FEEDBACK_PATCH_RETURN_COLUMNS } from "../columns";

const feedbackRow = {
  id: "feedback-1",
  feedback_type: "suggestion",
  message: "More satsang seats",
  name: "Asha",
  is_anonymous: false,
  email: "asha@example.com",
  room_or_facility: null,
  rating: 5,
  status: "in_review",
  internal_note: "Checking",
  created_at: "2026-05-01T00:00:00.000Z",
  updated_at: "2026-05-02T00:00:00.000Z",
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

describe("admin feedback detail API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns only compact update fields after feedback updates", async () => {
    const query = createQuery({ data: feedbackRow, error: null });
    const supabase = { from: vi.fn(() => query) };
    getServerSupabaseClientMock.mockResolvedValue(supabase);

    const response = await PATCH(
      new Request("http://localhost/api/admin/feedback/feedback-1", {
        method: "PATCH",
        body: JSON.stringify({ status: "in_review", internalNote: "Checking" }),
      }),
      { params: Promise.resolve({ id: "feedback-1" }) }
    );

    expect(response.status).toBe(200);
    expect(supabase.from).toHaveBeenCalledWith("feedback");
    expect(query.eq).toHaveBeenCalledWith("id", "feedback-1");
    expect(query.select).toHaveBeenCalledWith(ADMIN_FEEDBACK_PATCH_RETURN_COLUMNS);
    expect(query.maybeSingle).toHaveBeenCalledTimes(1);
    await expect(response.json()).resolves.toEqual({
      data: {
        id: "feedback-1",
        status: "in_review",
        internalNote: "Checking",
        updatedAt: "2026-05-02T00:00:00.000Z",
      },
    });
  });
});

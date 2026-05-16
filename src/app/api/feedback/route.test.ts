import { beforeEach, describe, expect, it, vi } from "vitest";

const createServerSupabaseClientMock = vi.hoisted(() => vi.fn());

vi.mock("@/integrations/supabase/server", () => ({
  createServerSupabaseClient: createServerSupabaseClientMock,
}));

import { POST } from "./route";

const createFeedbackQuery = (response: unknown) => {
  const query = {
    insert: vi.fn(async () => response),
    select: vi.fn(() => query),
  };
  return query;
};

describe("public feedback API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("stores feedback without selecting the inserted row and disables shared caching", async () => {
    const query = createFeedbackQuery({ error: null });
    createServerSupabaseClientMock.mockReturnValue({
      from: vi.fn(() => query),
    });

    const response = await POST(
      new Request("https://airvik.test/api/feedback", {
        method: "POST",
        body: JSON.stringify({
          feedbackType: "praise",
          message: "Peaceful stay.",
          name: "Asha",
          email: "asha@example.com",
          submitAsAnonymous: false,
          rating: 5,
        }),
      }),
    );

    expect(response.status).toBe(201);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(query.insert).toHaveBeenCalledWith([
      expect.objectContaining({
        feedback_type: "praise",
        message: "Peaceful stay.",
        name: "Asha",
        email: "asha@example.com",
        rating: 5,
      }),
    ]);
    expect(query.select).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual({
      message: "Thank you for your feedback! We appreciate your time.",
    });
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const cacheMocks = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  unstable_cache: vi.fn((fn) => fn),
}));
const supabaseMocks = vi.hoisted(() => ({
  createServerSupabaseClient: vi.fn(),
  createSessionClient: vi.fn(),
}));
const requirePagePermissionsMock = vi.hoisted(() => vi.fn());

vi.mock("next/cache", () => cacheMocks);
vi.mock("@/integrations/supabase/server", () => supabaseMocks);
vi.mock("@/lib/server/page-auth", () => ({
  requirePagePermissions: requirePagePermissionsMock,
}));

import {
  createReview,
  getPublishedReviews,
} from "./reviews";
import {
  PUBLIC_REVIEW_SELECT_COLUMNS,
  REVIEW_CREATE_RETURN_COLUMNS,
  REVIEWS_CACHE_TAG,
  REVIEWS_REVALIDATE_SECONDS,
} from "./cache-config";

const reviewRow = {
  reviewer_name: "Asha",
  reviewer_title: "Guest",
  content: "Peaceful stay.",
  image_url: "https://example.com/review.jpg",
};

const createReviewsQuery = (response: unknown) => {
  const query = {
    from: vi.fn(() => query),
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    order: vi.fn(() => query),
    limit: vi.fn(async () => response),
  };
  return query;
};

const createInsertQuery = (response: unknown) => {
  const query = {
    insert: vi.fn(() => query),
    select: vi.fn(() => query),
    single: vi.fn(async () => response),
  };
  return query;
};

describe("review server data access", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("declares a tagged cache policy for published public reviews", () => {
    expect(REVIEWS_CACHE_TAG).toBe("reviews");
    expect(REVIEWS_REVALIDATE_SECONDS).toBe(300);
  });

  it("selects only carousel public review fields and caps the query limit", async () => {
    const query = createReviewsQuery({ data: [reviewRow], error: null });
    supabaseMocks.createServerSupabaseClient.mockReturnValue(query);

    await expect(getPublishedReviews(200)).resolves.toEqual([
      {
        reviewerName: "Asha",
        reviewerTitle: "Guest",
        content: "Peaceful stay.",
        imageUrl: "https://example.com/review.jpg",
      },
    ]);

    expect(query.from).toHaveBeenCalledWith("testimonials");
    expect(query.select).toHaveBeenCalledWith(PUBLIC_REVIEW_SELECT_COLUMNS);
    expect(PUBLIC_REVIEW_SELECT_COLUMNS).not.toContain("id");
    expect(PUBLIC_REVIEW_SELECT_COLUMNS).not.toContain("is_published");
    expect(PUBLIC_REVIEW_SELECT_COLUMNS).not.toContain("updated_by");
    expect(PUBLIC_REVIEW_SELECT_COLUMNS).not.toContain("created_at");
    expect(PUBLIC_REVIEW_SELECT_COLUMNS).not.toContain("updated_at");
    expect(query.eq).toHaveBeenCalledWith("is_published", true);
    expect(query.order).toHaveBeenCalledWith("created_at", {
      ascending: false,
    });
    expect(query.limit).toHaveBeenCalledWith(20);
  });

  it("creates reviews by returning only generated fields", async () => {
    const reviewId = "22222222-2222-4222-8222-222222222222";
    const userId = "11111111-1111-4111-8111-111111111111";
    const query = createInsertQuery({
      data: {
        id: reviewId,
        created_at: "2026-05-14T00:00:00.000Z",
        updated_at: "2026-05-14T00:01:00.000Z",
      },
      error: null,
    });
    const getUser = vi.fn(async () => ({
      data: {
        user: { id: userId },
      },
    }));
    const supabase = {
      auth: { getUser },
      from: vi.fn(() => query),
    };
    supabaseMocks.createSessionClient.mockResolvedValue(supabase);

    await expect(
      createReview({
        reviewerName: "Asha",
        content: "Peaceful stay.",
        imageUrl: "https://example.com/review.jpg",
        isPublished: true,
      }),
    ).resolves.toEqual({
      id: reviewId,
      reviewerName: "Asha",
      reviewerTitle: undefined,
      content: "Peaceful stay.",
      imageUrl: "https://example.com/review.jpg",
      isPublished: true,
      createdAt: "2026-05-14T00:00:00.000Z",
      updatedAt: "2026-05-14T00:01:00.000Z",
      updatedBy: userId,
    });

    expect(requirePagePermissionsMock).toHaveBeenCalledWith("create:review");
    expect(supabase.from).toHaveBeenCalledWith("testimonials");
    expect(query.insert).toHaveBeenCalledWith({
      reviewer_name: "Asha",
      reviewer_title: null,
      content: "Peaceful stay.",
      image_url: "https://example.com/review.jpg",
      is_published: true,
      updated_by: userId,
      updated_at: expect.any(String),
    });
    expect(query.select).toHaveBeenCalledWith(REVIEW_CREATE_RETURN_COLUMNS);
  });
});

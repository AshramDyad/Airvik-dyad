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
  getPublishedReviews,
} from "./reviews";
import {
  PUBLIC_REVIEW_SELECT_COLUMNS,
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
});

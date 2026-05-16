import { beforeEach, describe, expect, it, vi } from "vitest";

const getPublishedReviewsMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/server/reviews", () => ({
  getPublishedReviews: getPublishedReviewsMock,
}));

import { GET } from "./route";

describe("reviews API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("serves published reviews with shared-cache headers", async () => {
    const reviews = [
      {
        reviewerName: "Asha",
        reviewerTitle: "Guest",
        content: "Peaceful stay.",
        imageUrl: "https://example.com/review.jpg",
      },
    ];
    getPublishedReviewsMock.mockResolvedValue(reviews);

    const response = await GET();

    expect(response.headers.get("Cache-Control")).toBe(
      "public, max-age=60, s-maxage=300, stale-while-revalidate=600"
    );
    const body = await response.json();
    expect(body).toEqual({ data: reviews });
    expect(body.data[0]).not.toHaveProperty("id");
    expect(body.data[0]).not.toHaveProperty("isPublished");
    expect(body.data[0]).not.toHaveProperty("updatedBy");
    expect(body.data[0]).not.toHaveProperty("createdAt");
    expect(body.data[0]).not.toHaveProperty("updatedAt");
    expect(getPublishedReviewsMock).toHaveBeenCalledTimes(1);
  });
});

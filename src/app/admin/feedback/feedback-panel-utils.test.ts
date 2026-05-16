import { describe, expect, it } from "vitest";

import type { Feedback } from "@/data/types";

import { mergeFeedbackUpdate } from "./feedback-panel-utils";

const feedback: Feedback = {
  id: "feedback-1",
  feedbackType: "suggestion",
  message: "More satsang seats",
  name: "Asha",
  isAnonymous: false,
  email: "asha@example.com",
  roomOrFacility: undefined,
  rating: 5,
  status: "new",
  internalNote: undefined,
  createdAt: "2026-05-01T00:00:00.000Z",
  updatedAt: "2026-05-01T00:00:00.000Z",
};

describe("feedback update merge", () => {
  it("merges compact update fields into an existing feedback item", () => {
    expect(
      mergeFeedbackUpdate(feedback, {
        id: "feedback-1",
        status: "in_review",
        internalNote: "Checking",
        updatedAt: "2026-05-02T00:00:00.000Z",
      }),
    ).toEqual({
      ...feedback,
      status: "in_review",
      internalNote: "Checking",
      updatedAt: "2026-05-02T00:00:00.000Z",
    });
  });

  it("ignores compact updates for other feedback ids", () => {
    expect(
      mergeFeedbackUpdate(feedback, {
        id: "feedback-2",
        status: "resolved",
        internalNote: "Done",
        updatedAt: "2026-05-02T00:00:00.000Z",
      }),
    ).toBe(feedback);
  });
});

import type { Feedback } from "@/data/types";

export type FeedbackPatchResult = {
  id: string;
  status: Feedback["status"];
  internalNote?: string;
  updatedAt: string;
};

export const mergeFeedbackUpdate = (
  feedback: Feedback,
  update: FeedbackPatchResult,
): Feedback => {
  if (feedback.id !== update.id) {
    return feedback;
  }

  return {
    ...feedback,
    status: update.status,
    internalNote: update.internalNote,
    updatedAt: update.updatedAt,
  };
};

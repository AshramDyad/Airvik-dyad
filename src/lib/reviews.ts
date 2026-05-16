import { z } from "zod";
import type { Review } from "@/data/types";

export const reviewRowSchema = z.object({
  id: z.string().uuid(),
  reviewer_name: z.string(),
  reviewer_title: z.string().nullable(),
  content: z.string(),
  image_url: z.string(),
  is_published: z.boolean(),
  updated_by: z.string().uuid().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type ReviewRow = z.infer<typeof reviewRowSchema>;

export const publicReviewRowSchema = z.object({
  reviewer_name: z.string(),
  reviewer_title: z.string().nullable(),
  content: z.string(),
  image_url: z.string(),
});

export type PublicReviewRow = z.infer<typeof publicReviewRowSchema>;
export type PublicReview = {
  reviewerName: string;
  reviewerTitle?: string;
  content: string;
  imageUrl: string;
};

export function mapReviewRow(row: ReviewRow): Review {
  return {
    id: row.id,
    reviewerName: row.reviewer_name,
    reviewerTitle: row.reviewer_title ?? undefined,
    content: row.content,
    imageUrl: row.image_url,
    isPublished: row.is_published,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    updatedBy: row.updated_by ?? undefined,
  };
}

export function mapPublicReviewRow(row: PublicReviewRow): PublicReview {
  return {
    reviewerName: row.reviewer_name,
    reviewerTitle: row.reviewer_title ?? undefined,
    content: row.content,
    imageUrl: row.image_url,
  };
}

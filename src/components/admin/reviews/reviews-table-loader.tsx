"use client";

import dynamic from "next/dynamic";

import type { Review } from "@/data/types";
import { Skeleton } from "@/components/ui/skeleton";

type ReviewsTableLoaderProps = {
  reviews: Review[];
};

const DynamicReviewsTable = dynamic<ReviewsTableLoaderProps>(
  () =>
    import("@/components/admin/reviews/reviews-table").then(
      (module) => module.ReviewsTable,
    ),
  {
    loading: () => <ReviewsTableSkeleton />,
  },
);

export function ReviewsTableLoader(props: ReviewsTableLoaderProps) {
  return <DynamicReviewsTable {...props} />;
}

function ReviewsTableSkeleton() {
  return <Skeleton className="h-[420px] rounded-lg" />;
}

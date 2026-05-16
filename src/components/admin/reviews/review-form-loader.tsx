"use client";

import dynamic from "next/dynamic";

import type { Review } from "@/data/types";
import { Skeleton } from "@/components/ui/skeleton";

type ReviewFormLoaderProps = {
  initialData?: Review | null;
};

const DynamicReviewForm = dynamic<ReviewFormLoaderProps>(
  () =>
    import("@/components/admin/reviews/review-form").then(
      (module) => module.ReviewForm,
    ),
  {
    loading: () => <ReviewFormSkeleton />,
  },
);

export function ReviewFormLoader(props: ReviewFormLoaderProps) {
  return <DynamicReviewForm {...props} />;
}

function ReviewFormSkeleton() {
  return (
    <div className="max-w-3xl rounded-2xl border border-border/50 bg-card text-foreground">
      <div className="flex flex-col gap-2 px-6 py-5">
        <Skeleton className="h-6 w-36" />
      </div>
      <div className="px-6 pb-6 pt-0 space-y-8">
        <Skeleton className="h-44 w-full rounded-lg" />
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-20 rounded-md" />
          <Skeleton className="h-20 rounded-md" />
        </div>
        <Skeleton className="h-40 rounded-md" />
        <Skeleton className="h-24 rounded-lg" />
        <Skeleton className="h-10 w-36 rounded-md" />
      </div>
    </div>
  );
}

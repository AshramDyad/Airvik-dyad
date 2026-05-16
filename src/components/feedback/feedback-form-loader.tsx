"use client";

import dynamic from "next/dynamic";

import { Skeleton } from "@/components/ui/skeleton";

const DynamicFeedbackForm = dynamic(
  () =>
    import("@/components/feedback/feedback-form").then(
      (module) => module.FeedbackForm,
    ),
  {
    loading: () => <FeedbackFormSkeleton />,
  },
);

export function FeedbackFormLoader() {
  return <DynamicFeedbackForm />;
}

function FeedbackFormSkeleton() {
  return (
    <div className="mx-auto w-full max-w-3xl rounded-3xl border border-border/20 bg-card/40 p-6 shadow-md">
      <div className="space-y-6">
        <Skeleton className="h-16 rounded-2xl" />
        <Skeleton className="h-44 rounded-2xl" />
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-20 rounded-2xl" />
          <Skeleton className="h-20 rounded-2xl" />
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-20 rounded-2xl" />
          <Skeleton className="h-20 rounded-2xl" />
        </div>
        <Skeleton className="h-12 rounded-2xl" />
      </div>
    </div>
  );
}

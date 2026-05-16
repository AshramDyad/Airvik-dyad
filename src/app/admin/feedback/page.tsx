"use client";

import dynamic from "next/dynamic";

import { Skeleton } from "@/components/ui/skeleton";

const FeedbackPanel = dynamic(() => import("./feedback-panel"), {
  loading: () => <FeedbackPanelSkeleton />,
});

export default function AdminFeedbackPage() {
  return <FeedbackPanel />;
}

function FeedbackPanelSkeleton() {
  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-8 w-72" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-10 w-28 rounded-full" />
          <Skeleton className="h-10 w-32 rounded-full" />
        </div>
      </div>
      <Skeleton className="h-56 w-full rounded-3xl" />
      <Skeleton className="h-[520px] w-full rounded-3xl" />
      <div className="flex justify-between gap-4">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-9 w-56" />
      </div>
    </div>
  );
}

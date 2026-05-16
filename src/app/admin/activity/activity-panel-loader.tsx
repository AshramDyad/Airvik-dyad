"use client";

import dynamic from "next/dynamic";

import { Skeleton } from "@/components/ui/skeleton";

const DynamicActivityPanel = dynamic(
  () => import("./activity-panel").then((module) => module.ActivityPanel),
  {
    loading: () => <ActivityPanelSkeleton />,
  },
);

export function ActivityPanelLoader() {
  return <DynamicActivityPanel />;
}

function ActivityPanelSkeleton() {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border/50 bg-card text-foreground">
        <div className="flex flex-col gap-2 px-6 py-5">
          <h3 className="text-lg font-serif font-semibold leading-none tracking-tight">
            Activity Filters
          </h3>
        </div>
        <div className="grid gap-4 px-6 pb-6 pt-0 md:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-16 rounded-md" />
          <Skeleton className="h-16 rounded-md" />
          <Skeleton className="h-16 rounded-md" />
          <Skeleton className="h-10 rounded-md" />
        </div>
      </div>
      <div className="rounded-2xl border border-border/50 bg-card text-foreground">
        <div className="flex flex-col gap-2 px-6 py-5">
          <h3 className="text-lg font-serif font-semibold leading-none tracking-tight">
            Recent Activity
          </h3>
        </div>
        <div className="px-6 pb-6 pt-0">
          <Skeleton className="h-[420px] rounded-lg" />
        </div>
      </div>
    </div>
  );
}

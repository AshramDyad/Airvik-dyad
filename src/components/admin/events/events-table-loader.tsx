"use client";

import dynamic from "next/dynamic";

import type { EventBanner } from "@/data/types";
import { Skeleton } from "@/components/ui/skeleton";

type EventsTableLoaderProps = {
  events: EventBanner[];
};

const DynamicEventsTable = dynamic<EventsTableLoaderProps>(
  () => import("./events-table").then((module) => module.EventsTable),
  {
    loading: () => <EventsTableSkeleton />,
  },
);

export function EventsTableLoader(props: EventsTableLoaderProps) {
  return <DynamicEventsTable {...props} />;
}

function EventsTableSkeleton() {
  return (
    <div className="rounded-md border bg-card">
      <div className="grid grid-cols-[100px_1fr_1fr_140px_120px] gap-4 border-b p-4">
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className="h-5 rounded-md" />
        ))}
      </div>
      <div className="divide-y">
        {Array.from({ length: 5 }).map((_, rowIndex) => (
          <div
            key={rowIndex}
            className="grid grid-cols-[100px_1fr_1fr_140px_120px] gap-4 p-4"
          >
            <Skeleton className="h-12 w-20 rounded-md" />
            <div className="space-y-2">
              <Skeleton className="h-5 w-40 rounded-md" />
              <Skeleton className="h-4 w-24 rounded-md" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-44 rounded-md" />
              <Skeleton className="h-4 w-44 rounded-md" />
            </div>
            <Skeleton className="h-6 w-24 rounded-full" />
            <div className="flex justify-end gap-2">
              <Skeleton className="h-9 w-9 rounded-md" />
              <Skeleton className="h-9 w-9 rounded-md" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

"use client";

import dynamic from "next/dynamic";

import type { EventBanner } from "@/data/types";
import { Skeleton } from "@/components/ui/skeleton";

type EventFormLoaderProps = {
  initialData?: EventBanner | null;
};

const DynamicEventForm = dynamic<EventFormLoaderProps>(
  () =>
    import("@/components/admin/events/event-form").then(
      (module) => module.EventForm,
    ),
  {
    loading: () => <EventFormSkeleton />,
  },
);

export function EventFormLoader(props: EventFormLoaderProps) {
  return <DynamicEventForm {...props} />;
}

function EventFormSkeleton() {
  return (
    <div className="max-w-4xl rounded-2xl border border-border/50 bg-card text-foreground">
      <div className="flex flex-col gap-2 px-6 py-5">
        <Skeleton className="h-6 w-40" />
      </div>
      <div className="px-6 pb-6 pt-0 space-y-8">
        <Skeleton className="h-52 w-full rounded-lg" />
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <Skeleton className="h-20 rounded-md" />
          <Skeleton className="h-28 rounded-lg" />
        </div>
        <Skeleton className="h-32 rounded-md" />
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <Skeleton className="h-20 rounded-md" />
          <Skeleton className="h-20 rounded-md" />
        </div>
        <Skeleton className="h-10 w-52 rounded-md" />
      </div>
    </div>
  );
}

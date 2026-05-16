"use client";

import dynamic from "next/dynamic";

import { Skeleton } from "@/components/ui/skeleton";

const DynamicHomeDeferredSections = dynamic(
  () =>
    import("./home-deferred-sections").then(
      (module) => module.HomeDeferredSections,
    ),
  {
    loading: () => <HomeDeferredSectionsSkeleton />,
  },
);

export function HomeDeferredSectionsLoader() {
  return <DynamicHomeDeferredSections />;
}

function HomeDeferredSectionsSkeleton() {
  return (
    <div className="container mx-auto space-y-12 px-4 py-10">
      <div className="grid gap-8 lg:grid-cols-2">
        <Skeleton className="h-80 rounded-2xl" />
        <div className="space-y-4">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-10 w-full max-w-xl" />
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-6 w-11/12" />
        </div>
      </div>
      <div className="grid gap-6 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-64 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}

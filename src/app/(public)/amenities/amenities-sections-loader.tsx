"use client";

import dynamic from "next/dynamic";

import { Skeleton } from "@/components/ui/skeleton";

const DynamicAmenitiesSections = dynamic(
  () =>
    import("./amenities-sections").then((module) => module.AmenitiesSections),
  {
    loading: () => <AmenitiesSectionsSkeleton />,
  },
);

export function AmenitiesSectionsLoader() {
  return <DynamicAmenitiesSections />;
}

function AmenitiesSectionsSkeleton() {
  return (
    <div className="container mx-auto space-y-12 px-4 py-10">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-32 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-80 rounded-3xl" />
      </div>
      <div className="space-y-6">
        <div className="mx-auto max-w-3xl space-y-3">
          <Skeleton className="mx-auto h-10 w-80" />
          <Skeleton className="mx-auto h-6 w-full" />
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton key={index} className="h-28 rounded-2xl" />
          ))}
        </div>
      </div>
    </div>
  );
}

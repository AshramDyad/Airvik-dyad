"use client";

import dynamic from "next/dynamic";

import { Skeleton } from "@/components/ui/skeleton";

const DynamicSunilBhagatSections = dynamic(
  () =>
    import("./sunil-bhagat-sections").then(
      (module) => module.SunilBhagatSections,
    ),
  {
    loading: () => <SunilBhagatSectionsSkeleton />,
  },
);

export function SunilBhagatSectionsLoader() {
  return <DynamicSunilBhagatSections />;
}

function SunilBhagatSectionsSkeleton() {
  return (
    <div className="container mx-auto space-y-12 px-4 py-10">
      <div className="grid gap-10 lg:grid-cols-2">
        <div className="space-y-4">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-10 w-full max-w-xl" />
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-6 w-11/12" />
          <Skeleton className="h-5 w-64" />
          <Skeleton className="h-5 w-72" />
        </div>
        <Skeleton className="aspect-video rounded-2xl" />
      </div>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="aspect-video rounded-xl" />
        ))}
      </div>
    </div>
  );
}

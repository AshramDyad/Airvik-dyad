"use client";

import dynamic from "next/dynamic";

import { Skeleton } from "@/components/ui/skeleton";

const DynamicJourneySections = dynamic(
  () => import("./journey-sections").then((module) => module.JourneySections),
  {
    loading: () => <JourneySectionsSkeleton />,
  },
);

export function JourneySectionsLoader() {
  return <DynamicJourneySections />;
}

function JourneySectionsSkeleton() {
  return (
    <div className="container mx-auto space-y-12 px-4 py-16">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="grid gap-8 md:grid-cols-2">
          <Skeleton className="h-72 rounded-xl" />
          <Skeleton className="h-72 rounded-xl" />
        </div>
      ))}
      <Skeleton className="h-72 rounded-2xl" />
    </div>
  );
}

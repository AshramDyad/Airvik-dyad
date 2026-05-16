"use client";

import dynamic from "next/dynamic";

import { Skeleton } from "@/components/ui/skeleton";

const DynamicRishikeshSections = dynamic(
  () =>
    import("./rishikesh-sections").then(
      (module) => module.RishikeshSections,
    ),
  {
    loading: () => <RishikeshSectionsSkeleton />,
  },
);

export function RishikeshSectionsLoader() {
  return <DynamicRishikeshSections />;
}

function RishikeshSectionsSkeleton() {
  return (
    <div className="container mx-auto space-y-10 px-4 py-10 sm:py-12">
      <div className="mx-auto max-w-3xl space-y-4 lg:text-center">
        <Skeleton className="mx-auto h-4 w-36" />
        <Skeleton className="mx-auto h-10 w-full max-w-lg" />
        <Skeleton className="mx-auto h-20 w-full max-w-2xl" />
      </div>
      <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-80 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-[450px] rounded-2xl" />
    </div>
  );
}

"use client";

import dynamic from "next/dynamic";

import { Skeleton } from "@/components/ui/skeleton";

const DynamicAboutUsSections = dynamic(
  () => import("./about-us-sections").then((module) => module.AboutUsSections),
  {
    loading: () => <AboutUsSectionsSkeleton />,
  },
);

export function AboutUsSectionsLoader() {
  return <DynamicAboutUsSections />;
}

function AboutUsSectionsSkeleton() {
  return (
    <div className="container mx-auto space-y-12 px-4 py-12">
      <div className="grid gap-10 lg:grid-cols-2">
        <Skeleton className="h-80 rounded-2xl" />
        <div className="space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-6 w-11/12" />
          <Skeleton className="h-6 w-10/12" />
        </div>
      </div>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-64 rounded-2xl" />
        ))}
      </div>
      <div className="flex flex-col items-center gap-8 sm:flex-row sm:justify-center">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-52 w-52 rounded-full" />
        ))}
      </div>
    </div>
  );
}

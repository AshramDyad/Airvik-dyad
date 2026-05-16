"use client";

import dynamic from "next/dynamic";

import { Skeleton } from "@/components/ui/skeleton";

const DynamicSunilBhagatProfile = dynamic(
  () =>
    import("./sunil-bhagat-profile").then(
      (module) => module.SunilBhagatProfile,
    ),
  {
    loading: () => <SunilBhagatProfileSkeleton />,
  },
);

export function SunilBhagatProfileLoader() {
  return <DynamicSunilBhagatProfile />;
}

function SunilBhagatProfileSkeleton() {
  return (
    <div className="container mx-auto px-4 py-10">
      <div className="mx-auto max-w-7xl space-y-8">
        <div className="mx-auto flex w-full max-w-[480px] gap-2 rounded-full bg-muted p-1.5">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-12 flex-1 rounded-full" />
          ))}
        </div>
        <div className="grid overflow-hidden rounded-3xl border border-border bg-card shadow-lg lg:grid-cols-5">
          <Skeleton className="h-[350px] rounded-none sm:h-[450px] lg:col-span-2 lg:h-auto" />
          <div className="space-y-4 p-4 sm:p-6 lg:col-span-3 lg:p-8">
            <Skeleton className="h-9 w-72" />
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-11/12" />
            <Skeleton className="h-6 w-10/12" />
            <div className="flex flex-wrap gap-3 pt-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-10 w-28 rounded-full" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

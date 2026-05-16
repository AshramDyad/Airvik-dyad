"use client";

import dynamic from "next/dynamic";

import { Skeleton } from "@/components/ui/skeleton";
import type { DonationsIndexPanelProps } from "./donations-index-panel";

const DynamicDonationsIndexPanel = dynamic<DonationsIndexPanelProps>(
  () =>
    import("./donations-index-panel").then(
      (module) => module.DonationsIndexPanel,
    ),
  {
    loading: () => <DonationsIndexSkeleton />,
  },
);

export function DonationsIndexLoader(props: DonationsIndexPanelProps) {
  return <DynamicDonationsIndexPanel {...props} />;
}

function DonationsIndexSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-4 rounded-2xl border border-border/40 bg-card/60 p-4">
        <Skeleton className="h-16 flex-1 min-w-[220px] rounded-xl" />
        <Skeleton className="h-16 w-40 rounded-xl" />
        <Skeleton className="h-16 w-40 rounded-xl" />
        <Skeleton className="h-16 w-40 rounded-xl" />
        <Skeleton className="h-16 w-40 rounded-xl" />
        <Skeleton className="h-10 w-28 rounded-md" />
        <Skeleton className="h-10 w-28 rounded-md" />
      </div>
      <div className="rounded-2xl border border-border/50 bg-card/70 shadow-sm">
        <div className="grid grid-cols-5 gap-4 border-b p-4">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-5 rounded-md" />
          ))}
        </div>
        <div className="divide-y">
          {Array.from({ length: 5 }).map((_, rowIndex) => (
            <div key={rowIndex} className="grid grid-cols-5 gap-4 p-4">
              {Array.from({ length: 5 }).map((_, cellIndex) => (
                <Skeleton key={cellIndex} className="h-12 rounded-md" />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

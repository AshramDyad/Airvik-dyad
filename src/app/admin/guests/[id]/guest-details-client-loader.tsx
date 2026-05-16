"use client";

import dynamic from "next/dynamic";

import { Skeleton } from "@/components/ui/skeleton";

const DynamicGuestDetailsClient = dynamic(
  () =>
    import("./guest-details-client").then(
      (module) => module.GuestDetailsClient,
    ),
  {
    loading: () => <GuestDetailsSkeleton />,
  },
);

export function GuestDetailsClientLoader() {
  return <DynamicGuestDetailsClient />;
}

function GuestDetailsSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-56 w-full rounded-lg" />
      <Skeleton className="h-[360px] w-full rounded-lg" />
    </div>
  );
}

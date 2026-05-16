"use client";

import dynamic from "next/dynamic";

import { Skeleton } from "@/components/ui/skeleton";

const DynamicReservationDetailsClient = dynamic(
  () =>
    import("./reservation-details-client").then(
      (module) => module.ReservationDetailsClient,
    ),
  {
    loading: () => <ReservationDetailsShellSkeleton />,
  },
);

export function ReservationDetailsClientLoader() {
  return <DynamicReservationDetailsClient />;
}

function ReservationDetailsShellSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-16 w-full rounded-2xl" />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-1">
          <Skeleton className="h-72 w-full rounded-2xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
          <Skeleton className="h-56 w-full rounded-2xl" />
        </div>
        <div className="space-y-6 lg:col-span-2">
          <Skeleton className="h-96 w-full rounded-2xl" />
          <Skeleton className="h-80 w-full rounded-2xl" />
        </div>
      </div>
    </div>
  );
}

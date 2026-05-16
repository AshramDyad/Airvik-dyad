"use client";

import dynamic from "next/dynamic";

import { Skeleton } from "@/components/ui/skeleton";

const DynamicReservationEditClient = dynamic(
  () =>
    import("./reservation-edit-client").then(
      (module) => module.ReservationEditClient,
    ),
  {
    loading: () => <ReservationEditShellSkeleton />,
  },
);

export function ReservationEditClientLoader() {
  return <DynamicReservationEditClient />;
}

function ReservationEditShellSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Skeleton className="h-9 w-36" />
        <Skeleton className="h-6 w-28 rounded-full" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-32" />
      </div>
      <div className="grid gap-6 lg:grid-cols-5">
        <Skeleton className="h-[520px] w-full rounded-2xl lg:col-span-3" />
        <Skeleton className="h-[520px] w-full rounded-2xl lg:col-span-2" />
      </div>
    </div>
  );
}

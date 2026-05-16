"use client";

import dynamic from "next/dynamic";

import { PermissionGate } from "@/components/admin/permission-gate";
import { Skeleton } from "@/components/ui/skeleton";

const AvailabilityCalendar = dynamic(
  () =>
    import("@/components/shared/availability-calendar").then(
      (module) => module.AvailabilityCalendar,
    ),
  { loading: () => <AvailabilityCalendarSkeleton /> },
);

export function CalendarPanel() {
  return (
    <PermissionGate feature="calendar">
      <div>
        <AvailabilityCalendar />
      </div>
    </PermissionGate>
  );
}

function AvailabilityCalendarSkeleton() {
  return (
    <div className="rounded-3xl border border-border/60 bg-card shadow-xl">
      <div className="border-b border-border/50 px-4 py-5 sm:px-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <Skeleton className="h-14 w-72 rounded-2xl" />
            <Skeleton className="h-14 w-32 rounded-xl" />
            <Skeleton className="h-14 w-36 rounded-xl" />
            <Skeleton className="h-14 w-14 rounded-xl" />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Skeleton className="h-8 w-20 rounded-full" />
            <Skeleton className="h-8 w-32 rounded-full" />
            <Skeleton className="h-8 w-24 rounded-full" />
          </div>
        </div>
      </div>
      <div className="p-4 sm:p-6">
        <Skeleton className="h-[700px] w-full rounded-2xl" />
      </div>
    </div>
  );
}

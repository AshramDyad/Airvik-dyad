"use client";

import dynamic from "next/dynamic";

import { Skeleton } from "@/components/ui/skeleton";

const DynamicBookingClient = dynamic(
  () => import("./booking-client").then((module) => module.BookingClient),
  {
    loading: () => <BookingClientSkeleton />,
  },
);

export function BookingClientLoader() {
  return <DynamicBookingClient />;
}

function BookingClientSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-10">
        <div className="space-y-8">
          <Skeleton className="h-64 w-full rounded-2xl" />
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <Skeleton className="h-80 rounded-2xl" />
            <Skeleton className="h-80 rounded-2xl" />
            <Skeleton className="h-80 rounded-2xl" />
          </div>
        </div>
      </div>
    </div>
  );
}

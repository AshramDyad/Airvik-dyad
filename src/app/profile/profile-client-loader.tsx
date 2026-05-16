"use client";

import dynamic from "next/dynamic";

import { Skeleton } from "@/components/ui/skeleton";

const DynamicProfileClient = dynamic(
  () => import("./profile-client").then((module) => module.ProfileClient),
  {
    loading: () => <ProfileSkeleton />,
  },
);

export function ProfileClientLoader() {
  return <DynamicProfileClient />;
}

function ProfileSkeleton() {
  return (
    <div className="mx-auto max-w-2xl space-y-4 p-8">
      <Skeleton className="h-10 w-48" />
      <div className="space-y-2">
        <Skeleton className="h-5 w-64" />
        <Skeleton className="h-5 w-80" />
      </div>
    </div>
  );
}

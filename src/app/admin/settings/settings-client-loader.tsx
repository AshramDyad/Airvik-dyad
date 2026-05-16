"use client";

import dynamic from "next/dynamic";

import { Skeleton } from "@/components/ui/skeleton";

const DynamicSettingsClient = dynamic(
  () => import("./settings-client").then((module) => module.SettingsClient),
  {
    loading: () => <SettingsSkeleton />,
  },
);

export function SettingsClientLoader() {
  return <DynamicSettingsClient />;
}

function SettingsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-5 w-full max-w-lg" />
      </div>
      <Skeleton className="h-10 w-full max-w-3xl rounded-md" />
      <Skeleton className="h-[520px] w-full rounded-lg" />
    </div>
  );
}

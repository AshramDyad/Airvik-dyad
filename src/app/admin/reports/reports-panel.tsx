"use client";

import dynamic from "next/dynamic";

import { PermissionGate } from "@/components/admin/permission-gate";
import { Skeleton } from "@/components/ui/skeleton";

const ReportsTabs = dynamic(
  () => import("./reports-tabs").then((module) => module.ReportsTabs),
  { loading: () => <ReportsTabsSkeleton /> },
);

export function ReportsPanel() {
  return (
    <PermissionGate feature="reports">
      <div className="space-y-6">
        <div className="space-y-2">
          <h2 className="font-serif text-3xl font-semibold tracking-tight">Reports</h2>
          <p className="text-sm text-muted-foreground uppercase tracking-wide">
            Generate and view reports for your property.
          </p>
        </div>
        <ReportsTabs />
      </div>
    </PermissionGate>
  );
}

function ReportsTabsSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-12 w-full rounded-2xl" />
      <Skeleton className="h-[430px] w-full rounded-2xl" />
    </div>
  );
}

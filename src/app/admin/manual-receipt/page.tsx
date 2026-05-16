"use client";

import dynamic from "next/dynamic";

import { Skeleton } from "@/components/ui/skeleton";

const ManualReceiptHistory = dynamic(() => import("./manual-receipt-history"), {
  loading: () => <ManualReceiptHistorySkeleton />,
});

export default function ManualReceiptPage() {
  return <ManualReceiptHistory />;
}

function ManualReceiptHistorySkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-52" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <Skeleton className="h-16 w-40" />
        <Skeleton className="h-16 w-40" />
        <Skeleton className="h-16 w-40" />
        <Skeleton className="h-16 w-40" />
        <Skeleton className="h-9 w-20" />
      </div>
      <Skeleton className="h-[520px] w-full rounded-md" />
    </div>
  );
}

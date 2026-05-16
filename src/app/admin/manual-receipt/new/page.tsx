"use client";

import dynamic from "next/dynamic";

import { Skeleton } from "@/components/ui/skeleton";

const NewManualReceiptForm = dynamic(() => import("./new-manual-receipt-form"), {
  loading: () => <NewManualReceiptSkeleton />,
});

export default function NewManualReceiptPage() {
  return <NewManualReceiptForm />;
}

function NewManualReceiptSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <Skeleton className="h-10 w-10 rounded-md" />
        <div className="space-y-2">
          <Skeleton className="h-8 w-72" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>
      </div>
      <Skeleton className="h-80 w-full rounded-2xl" />
      <Skeleton className="h-80 w-full rounded-2xl" />
      <div className="flex gap-4">
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-10 w-40" />
      </div>
    </div>
  );
}

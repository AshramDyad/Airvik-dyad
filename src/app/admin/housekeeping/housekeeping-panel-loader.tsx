"use client";

import dynamic from "next/dynamic";

const DynamicHousekeepingPanel = dynamic(
  () => import("./housekeeping-panel"),
  {
    ssr: false,
    loading: () => <PanelSkeleton />,
  },
);

export function HousekeepingPanelLoader() {
  return <DynamicHousekeepingPanel />;
}

function PanelSkeleton() {
  return <div className="min-h-64 rounded-lg border bg-muted/20" />;
}

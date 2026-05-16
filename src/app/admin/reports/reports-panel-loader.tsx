"use client";

import dynamic from "next/dynamic";

const DynamicReportsPanel = dynamic(
  () => import("./reports-panel").then((module) => module.ReportsPanel),
  {
    ssr: false,
    loading: () => <PanelSkeleton />,
  },
);

export function ReportsPanelLoader() {
  return <DynamicReportsPanel />;
}

function PanelSkeleton() {
  return <div className="min-h-64 rounded-lg border bg-muted/20" />;
}

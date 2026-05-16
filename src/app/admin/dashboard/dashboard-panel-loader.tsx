"use client";

import dynamic from "next/dynamic";

const DynamicDashboardPanel = dynamic(
  () =>
    import("./components/dashboard-panel").then(
      (module) => module.DashboardPanel,
    ),
  {
    ssr: false,
    loading: () => <PanelSkeleton />,
  },
);

export function DashboardPanelLoader() {
  return <DynamicDashboardPanel />;
}

function PanelSkeleton() {
  return <div className="min-h-64 rounded-lg border bg-muted/20" />;
}

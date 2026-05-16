"use client";

import dynamic from "next/dynamic";

const DynamicRatesPanel = dynamic(
  () => import("./components/rates-panel").then((module) => module.RatesPanel),
  {
    ssr: false,
    loading: () => <PanelSkeleton />,
  },
);

export function RatesPanelLoader() {
  return <DynamicRatesPanel />;
}

function PanelSkeleton() {
  return <div className="min-h-64 rounded-lg border bg-muted/20" />;
}

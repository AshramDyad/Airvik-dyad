"use client";

import dynamic from "next/dynamic";

const DynamicGuestsPanel = dynamic(
  () => import("./components/guests-panel").then((module) => module.GuestsPanel),
  {
    ssr: false,
    loading: () => <PanelSkeleton />,
  },
);

export function GuestsPanelLoader() {
  return <DynamicGuestsPanel />;
}

function PanelSkeleton() {
  return <div className="min-h-64 rounded-lg border bg-muted/20" />;
}

"use client";

import dynamic from "next/dynamic";

const DynamicCalendarPanel = dynamic(
  () => import("./calendar-panel").then((module) => module.CalendarPanel),
  {
    ssr: false,
    loading: () => <PanelSkeleton />,
  },
);

export function CalendarPanelLoader() {
  return <DynamicCalendarPanel />;
}

function PanelSkeleton() {
  return <div className="min-h-64 rounded-lg border bg-muted/20" />;
}

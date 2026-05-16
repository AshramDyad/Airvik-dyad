"use client";

import dynamic from "next/dynamic";

const DynamicRoomsPanel = dynamic(
  () => import("./components/rooms-panel").then((module) => module.RoomsPanel),
  {
    ssr: false,
    loading: () => <PanelSkeleton />,
  },
);

export function RoomsPanelLoader() {
  return <DynamicRoomsPanel />;
}

function PanelSkeleton() {
  return <div className="min-h-64 rounded-lg border bg-muted/20" />;
}

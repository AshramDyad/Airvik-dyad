"use client";

import dynamic from "next/dynamic";

const DynamicRoomTypesPanel = dynamic(
  () =>
    import("./components/room-types-panel").then(
      (module) => module.RoomTypesPanel,
    ),
  {
    ssr: false,
    loading: () => <PanelSkeleton />,
  },
);

export function RoomTypesPanelLoader() {
  return <DynamicRoomTypesPanel />;
}

function PanelSkeleton() {
  return <div className="min-h-64 rounded-lg border bg-muted/20" />;
}

"use client";

import dynamic from "next/dynamic";

const DynamicRoomCategoriesPanel = dynamic(
  () =>
    import("./components/room-categories-panel").then(
      (module) => module.RoomCategoriesPanel,
    ),
  {
    ssr: false,
    loading: () => <PanelSkeleton />,
  },
);

export function RoomCategoriesPanelLoader() {
  return <DynamicRoomCategoriesPanel />;
}

function PanelSkeleton() {
  return <div className="min-h-64 rounded-lg border bg-muted/20" />;
}

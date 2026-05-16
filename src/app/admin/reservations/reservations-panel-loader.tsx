"use client";

import dynamic from "next/dynamic";

const DynamicReservationsPanel = dynamic(
  () =>
    import("./components/reservations-panel").then(
      (module) => module.ReservationsPanel,
    ),
  {
    ssr: false,
    loading: () => <PanelSkeleton />,
  },
);

export function ReservationsPanelLoader() {
  return <DynamicReservationsPanel />;
}

function PanelSkeleton() {
  return <div className="min-h-64 rounded-lg border bg-muted/20" />;
}

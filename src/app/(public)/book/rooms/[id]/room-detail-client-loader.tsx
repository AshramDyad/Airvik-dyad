"use client";

import dynamic from "next/dynamic";

import { RoomDetailsSkeleton } from "@/components/public/room-details-skeleton";

const DynamicRoomDetailClient = dynamic(
  () =>
    import("./room-detail-client").then((module) => module.RoomDetailClient),
  {
    loading: () => <RoomDetailsSkeleton />,
  },
);

export function RoomDetailClientLoader() {
  return <DynamicRoomDetailClient />;
}

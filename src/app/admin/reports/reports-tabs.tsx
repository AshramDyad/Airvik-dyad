"use client";

import dynamic from "next/dynamic";

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { BookingsReport } from "./components/bookings-report";

const OccupancyReport = dynamic(
  () =>
    import("./components/occupancy-report").then(
      (module) => module.OccupancyReport,
    ),
  {
    loading: () => <ReportPanelLoading />,
  },
);

const RevenueReport = dynamic(
  () =>
    import("./components/revenue-report").then((module) => module.RevenueReport),
  {
    loading: () => <ReportPanelLoading />,
  },
);

function ReportPanelLoading() {
  return (
    <div
      aria-label="Loading report"
      className="h-[430px] animate-pulse rounded-2xl border border-border/50 bg-muted/20"
    />
  );
}

export function ReportsTabs() {
  return (
    <Tabs defaultValue="bookings" className="w-full">
      <TabsList className="flex w-full flex-wrap gap-2 rounded-2xl border border-border/40 bg-card/80 p-1 shadow-sm">
        <TabsTrigger
          value="bookings"
          className="rounded-xl px-4 py-2 text-sm font-medium data-[state=active]:bg-primary/10 data-[state=active]:text-primary"
        >
          Bookings
        </TabsTrigger>
        <TabsTrigger
          value="occupancy"
          className="rounded-xl px-4 py-2 text-sm font-medium data-[state=active]:bg-primary/10 data-[state=active]:text-primary"
        >
          Occupancy Report
        </TabsTrigger>
        <TabsTrigger
          value="revenue"
          className="rounded-xl px-4 py-2 text-sm font-medium data-[state=active]:bg-primary/10 data-[state=active]:text-primary"
        >
          Revenue
        </TabsTrigger>
        <TabsTrigger
          value="guests"
          disabled
          className="rounded-xl px-4 py-2 text-sm font-medium"
        >
          Guests (Coming Soon)
        </TabsTrigger>
      </TabsList>
      <TabsContent value="bookings" className="pt-6">
        <BookingsReport />
      </TabsContent>
      <TabsContent value="occupancy" className="pt-6">
        <OccupancyReport />
      </TabsContent>
      <TabsContent value="revenue" className="pt-6">
        <RevenueReport />
      </TabsContent>
    </Tabs>
  );
}

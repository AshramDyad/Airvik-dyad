"use client";

import * as React from "react";
import { format } from "date-fns";
import {
  Building2,
  Check,
  Edit,
  Hotel,
  LogIn,
  LogOut,
} from "lucide-react";
import {
  closestCenter,
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";

import { PermissionGate } from "@/components/admin/permission-gate";
import { Button } from "@/components/ui/button";
import type { DashboardComponentId } from "@/data/types";
import { useDataContext } from "@/context/data-context";
import { AvailabilityCalendar } from "@/components/shared/availability-calendar";
import { EMPTY_DASHBOARD_SUMMARY } from "@/lib/dashboard/summary";
import { useDashboardSummary } from "@/hooks/use-dashboard-summary";
import { DashboardStickyNotes } from "./DashboardStickyNotes";
import { DraggableCard } from "./DraggableCard";
import { StatCardContent } from "./stat-card-content";
import { DashboardTable } from "./dashboard-table";
import {
  CalendarSkeleton,
  DashboardTableSkeleton,
  StatCardsSkeleton,
  StickyNotesSkeleton,
} from "./dashboard-skeleton";

export function DashboardPanel() {
  const {
    dashboardLayout,
    updateDashboardLayout,
    isLoading,
  } = useDataContext();
  const [isEditing, setIsEditing] = React.useState(false);
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const todayDate = React.useMemo(() => format(new Date(), "yyyy-MM-dd"), []);
  const { summary, isLoading: isSummaryLoading } =
    useDashboardSummary(todayDate);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const {
    occupancyPercentage,
    occupiedRoomsCount,
    availableRooms,
    arrivalsRows,
    departuresRows,
    roomsForSaleCount,
  } = summary ?? EMPTY_DASHBOARD_SUMMARY;

  const todayArrivalsCount = arrivalsRows.length;
  const todayDeparturesCount = departuresRows.length;
  const isSummaryPanelLoading = isLoading || isSummaryLoading;

  const components: Record<DashboardComponentId, React.ReactNode> = {
    stats: isSummaryPanelLoading ? (
      <StatCardsSkeleton />
    ) : (
      <div className="grid gap-4 sm:gap-6 md:grid-cols-2 xl:grid-cols-4">
        <StatCardContent
          icon={Building2}
          title="Occupancy"
          subtitle="Overall occupancy rate"
          value={`${occupancyPercentage.toFixed(0)}%`}
          context={`${occupiedRoomsCount} of ${roomsForSaleCount} rooms occupied`}
        />
        <StatCardContent
          icon={LogIn}
          title="Arrivals Today"
          subtitle="Check-ins scheduled"
          value={todayArrivalsCount}
          context={
            todayArrivalsCount === 1
              ? "1 guest arriving"
              : `${todayArrivalsCount} guests arriving`
          }
        />
        <StatCardContent
          icon={LogOut}
          title="Departures Today"
          subtitle="Check-outs scheduled"
          value={todayDeparturesCount}
          context={
            todayDeparturesCount === 1
              ? "1 guest departing"
              : `${todayDeparturesCount} guests departing`
          }
        />
        <StatCardContent
          icon={Hotel}
          title="Available Rooms"
          subtitle="Ready for check-in"
          value={availableRooms}
          context={
            availableRooms === 1
              ? "1 room available"
              : `${availableRooms} rooms available`
          }
        />
      </div>
    ),
    tables: isSummaryPanelLoading ? (
      <div className="grid min-w-0 gap-6 md:gap-8 xl:grid-cols-2">
        <DashboardTableSkeleton />
        <DashboardTableSkeleton />
      </div>
    ) : (
      <div className="grid min-w-0 gap-6 md:gap-8 xl:grid-cols-2">
        <div className="flex min-w-0 flex-col rounded-2xl border border-border/60 bg-card/80 shadow-sm overflow-hidden">
          <div className="shrink-0 border-b border-border/50 p-4">
            <h3 className="font-serif text-lg font-semibold">
              Today&apos;s Arrivals
            </h3>
            <p className="text-sm text-muted-foreground">
              Guests scheduled to check-in today.
            </p>
          </div>
          <div className="flex-1 min-w-0 p-0">
            <DashboardTable
              headers={["Guest", "Room", "Status"]}
              rows={arrivalsRows}
              emptyMessage="No arrivals today."
            />
          </div>
        </div>
        <div className="flex min-w-0 flex-col rounded-2xl border border-border/60 bg-card/80 shadow-sm overflow-hidden">
          <div className="shrink-0 border-b border-border/50 p-4">
            <h3 className="font-serif text-lg font-semibold">
              Today&apos;s Departures
            </h3>
            <p className="text-sm text-muted-foreground">
              Guests scheduled to check-out today.
            </p>
          </div>
          <div className="flex-1 min-w-0 p-0">
            <DashboardTable
              headers={["Guest", "Room", "Status"]}
              rows={departuresRows}
              emptyMessage="No departures today."
            />
          </div>
        </div>
      </div>
    ),
    notes: isLoading ? <StickyNotesSkeleton /> : <DashboardStickyNotes />,
    calendar: isLoading ? <CalendarSkeleton /> : <AvailabilityCalendar />,
  };

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = dashboardLayout.indexOf(
        active.id as DashboardComponentId,
      );
      const newIndex = dashboardLayout.indexOf(
        over.id as DashboardComponentId,
      );
      updateDashboardLayout(arrayMove(dashboardLayout, oldIndex, newIndex));
    }
    setActiveId(null);
  }

  return (
    <PermissionGate feature="dashboard">
      <div className="flex min-h-[60vh] flex-col gap-6">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={dashboardLayout}
          strategy={verticalListSortingStrategy}
        >
          <div className="flex min-w-0 flex-col gap-6 md:gap-8">
            {dashboardLayout.map((id) => (
              <DraggableCard key={id} id={id} isEditing={isEditing}>
                {components[id]}
              </DraggableCard>
            ))}
          </div>
        </SortableContext>
        <DragOverlay>
          {activeId ? (
            <div className="shadow-2xl">
              {components[activeId as DashboardComponentId]}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
      <div className="flex justify-end pt-2">
        <Button
          variant="outline"
          size="sm"
          className="focus-visible:ring-0"
          onClick={() => setIsEditing(!isEditing)}
        >
          {isEditing ? (
            <Check className="mr-2 h-4 w-4" />
          ) : (
            <Edit className="mr-2 h-4 w-4" />
          )}
          {isEditing ? "Save Layout" : "Edit Layout"}
        </Button>
      </div>
      </div>
    </PermissionGate>
  );
}

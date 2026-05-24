"use client";

import * as React from "react";
import {
    Building2,
    Hotel,
    LogIn,
    LogOut,
    Edit,
    Check,
  } from "lucide-react";
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
    DragStartEvent,
    DragOverlay,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
  
  import { Button } from "@/components/ui/button";
  import type { DashboardComponentId } from "@/data/types";
import { parseISO } from "date-fns";
import { useDataContext } from "@/context/data-context";
  import { AvailabilityCalendar } from "@/components/shared/availability-calendar";
  import { DashboardStickyNotes } from "./components/DashboardStickyNotes";
  import { DraggableCard } from "./components/DraggableCard";
  import { StatCardContent } from "./components/stat-card-content";
  import { DashboardTable, type DashboardTableRow } from "./components/dashboard-table";
  import { 
    StatCardsSkeleton, 
    DashboardTableSkeleton, 
    StickyNotesSkeleton, 
    CalendarSkeleton 
  } from "./components/dashboard-skeleton";
import { getTodayRange } from "@/lib/date";
import { PermissionGate } from "@/components/admin/permission-gate";
import { isActiveRoomHold } from "@/lib/reservations/status";
  
  export default function DashboardPage() {
    const { todayReservations, guests, dashboardLayout, updateDashboardLayout, rooms, isLoading } = useDataContext();
    const [isEditing, setIsEditing] = React.useState(false);
    const [activeId, setActiveId] = React.useState<string | null>(null);
    const todayRange = React.useMemo(() => getTodayRange(), []);

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
          coordinateGetter: sortableKeyboardCoordinates,
        })
    );
    const {
      occupancyPercentage,
      occupiedRoomsCount,
      availableRooms,
      arrivalsRows,
      departuresRows,
      roomsForSaleCount,
    } = React.useMemo(() => {
      const CANCELLED_STATUSES = new Set(["Cancelled", "No-show"]);
      const guestMap = new Map(guests.map((guest) => [guest.id, guest]));
      const roomMap = new Map(rooms.map((room) => [room.id, room]));
      const roomsAvailableForSale = rooms.filter((room) => room.status !== "Maintenance");

      let occupiedRooms = 0;
      let heldRooms = 0;
      const arrivals: Array<{ row: DashboardTableRow; sort: number }> = [];
      const departures: Array<{ row: DashboardTableRow; sort: number }> = [];

      todayReservations.forEach((reservation) => {
        if (CANCELLED_STATUSES.has(reservation.status)) {
          return;
        }

        if (reservation.status === "Room Hold" && !isActiveRoomHold(reservation)) {
          return;
        }

        const checkIn = parseISO(reservation.checkInDate);
        const checkOut = parseISO(reservation.checkOutDate);

        if (checkIn >= todayRange.start && checkIn <= todayRange.end) {
          const guest = guestMap.get(reservation.guestId);
          const room = roomMap.get(reservation.roomId);
          arrivals.push({
            sort: checkIn.getTime(),
            row: {
              id: reservation.id,
              guestName: guest ? `${guest.firstName} ${guest.lastName}` : "Unknown Guest",
              guestEmail: guest?.email,
              roomNumber: room?.roomNumber || "N/A",
              status: reservation.status,
            },
          });
        }

        if (checkOut >= todayRange.start && checkOut <= todayRange.end) {
          const guest = guestMap.get(reservation.guestId);
          const room = roomMap.get(reservation.roomId);
          departures.push({
            sort: checkOut.getTime(),
            row: {
              id: reservation.id,
              guestName: guest ? `${guest.firstName} ${guest.lastName}` : "Unknown Guest",
              guestEmail: guest?.email,
              roomNumber: room?.roomNumber || "N/A",
              status: reservation.status,
            },
          });
        }

        const stayCoversToday = todayRange.start >= checkIn && todayRange.start < checkOut;
        if (stayCoversToday && isActiveRoomHold(reservation)) {
          heldRooms += 1;
          return;
        }

        if (reservation.status === "Checked-in" || (stayCoversToday && reservation.status === "Confirmed")) {
          occupiedRooms += 1;
        }
      });

      const availableRoomsCount = Math.max(roomsAvailableForSale.length - occupiedRooms - heldRooms, 0);
      const occupancy = roomsAvailableForSale.length
        ? (occupiedRooms / roomsAvailableForSale.length) * 100
        : 0;

      const sortByDate = (a: { sort: number }, b: { sort: number }) => a.sort - b.sort;

      return {
        occupancyPercentage: occupancy,
        occupiedRoomsCount: occupiedRooms,
        availableRooms: availableRoomsCount,
        arrivalsRows: arrivals.sort(sortByDate).map((item) => item.row),
        departuresRows: departures.sort(sortByDate).map((item) => item.row),
        roomsForSaleCount: roomsAvailableForSale.length,
      };
    }, [guests, todayReservations, rooms, todayRange]);

    const todayArrivalsCount = arrivalsRows.length;
    const todayDeparturesCount = departuresRows.length;

    const components: Record<DashboardComponentId, React.ReactNode> = {
        stats: isLoading ? (
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
                    context={todayArrivalsCount === 1 ? "1 guest arriving" : `${todayArrivalsCount} guests arriving`}
                />
                <StatCardContent
                    icon={LogOut}
                    title="Departures Today"
                    subtitle="Check-outs scheduled"
                    value={todayDeparturesCount}
                    context={todayDeparturesCount === 1 ? "1 guest departing" : `${todayDeparturesCount} guests departing`}
                />
                <StatCardContent
                    icon={Hotel}
                    title="Available Rooms"
                    subtitle="Ready for check-in"
                    value={availableRooms}
                    context={availableRooms === 1 ? "1 room available" : `${availableRooms} rooms available`}
                />
            </div>
        ),
        tables: isLoading ? (
            <div className="grid min-w-0 gap-6 md:gap-8 xl:grid-cols-2">
                <DashboardTableSkeleton />
                <DashboardTableSkeleton />
            </div>
        ) : (
            <div className="grid min-w-0 gap-6 md:gap-8 xl:grid-cols-2">
                <div className="flex min-w-0 flex-col rounded-2xl border border-border/60 bg-card/80 shadow-sm overflow-hidden">
                    <div className="shrink-0 border-b border-border/50 p-4">
                        <h3 className="font-serif text-lg font-semibold">Today&apos;s Arrivals</h3>
                        <p className="text-sm text-muted-foreground">Guests scheduled to check-in today.</p>
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
                        <h3 className="font-serif text-lg font-semibold">Today&apos;s Departures</h3>
                        <p className="text-sm text-muted-foreground">Guests scheduled to check-out today.</p>
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
        const {active, over} = event;
        if (over && active.id !== over.id) {
          const oldIndex = dashboardLayout.indexOf(active.id as DashboardComponentId);
          const newIndex = dashboardLayout.indexOf(over.id as DashboardComponentId);
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
                <SortableContext items={dashboardLayout} strategy={verticalListSortingStrategy}>
                    <div className="flex min-w-0 flex-col gap-6 md:gap-8">
                        {dashboardLayout.map(id => (
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
                <Button variant="outline" size="sm" className="focus-visible:ring-0" onClick={() => setIsEditing(!isEditing)}>
                    {isEditing ? <Check className="mr-2 h-4 w-4" /> : <Edit className="mr-2 h-4 w-4" />}
                    {isEditing ? "Save Layout" : "Edit Layout"}
                </Button>
            </div>
        </div>
      </PermissionGate>
    );
  }

"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useDataContext } from "@/context/data-context";
import type { ReservationWithDetails } from "@/app/admin/reservations/components/columns";

interface LinkedReservationsCardProps {
  reservations: ReservationWithDetails[];
}

export function LinkedReservationsCard({
  reservations,
}: LinkedReservationsCardProps) {
  const { rooms, roomTypes } = useDataContext();

  const sortedReservations = [...reservations].sort((a, b) => {
    const roomA = a.roomNumber || "";
    const roomB = b.roomNumber || "";
    return roomA.localeCompare(roomB, undefined, {
      numeric: true,
      sensitivity: "base",
    });
  });

  const descriptionPrefix =
    reservations.length === 1
      ? "This booking currently includes 1 confirmed room."
      : `This booking currently includes ${reservations.length} confirmed rooms.`;
  const description = `${descriptionPrefix} Rooms listed here reflect the latest selection for this booking.`;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-serif text-lg font-semibold">
          Group Booking
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {sortedReservations.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border/60 p-4 text-center text-sm text-muted-foreground">
            No rooms are currently assigned to this booking.
          </p>
        ) : (
          <div className="rounded-2xl border border-border/40 max-h-80 overflow-y-auto">
            <Table>
              <TableBody>
                {sortedReservations.map((res) => {
                  const room = rooms.find((r) => r.id === res.roomId);
                  const roomType = roomTypes.find(
                    (rt) => rt.id === room?.roomTypeId,
                  );
                  const roomLabel = room?.roomNumber || res.roomNumber || "N/A";
                  return (
                    <TableRow key={res.id}>
                      <TableCell className="space-y-1">
                        <p className="font-medium">
                          {roomType?.name || "Room type"} · Room {roomLabel}
                        </p>
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline" className="capitalize">
                          {res.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

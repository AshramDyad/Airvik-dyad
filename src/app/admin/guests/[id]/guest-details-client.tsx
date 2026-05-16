"use client";

import * as React from "react";

import { useParams, notFound } from "next/navigation";
import { useDataContext } from "@/context/data-context";
import { AppSkeleton } from "@/components/layout/app-skeleton";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getCountryByCode } from "@/lib/countries";
import { useGuestProfile } from "@/hooks/use-guest-profile";
import { useGuestReservations } from "@/hooks/use-guest-reservations";

export function GuestDetailsClient() {
  const params = useParams<{ id: string }>();
  const guestIdFromParams = React.useMemo(() => {
    if (!params) return "";
    const value = params.id;
    return Array.isArray(value) ? value[0] ?? "" : value ?? "";
  }, [params]);
  const { isLoading } = useDataContext();
  const {
    guest,
    isLoading: isGuestProfileLoading,
  } = useGuestProfile(guestIdFromParams);
  const {
    reservations: guestReservationRows,
    isLoading: isGuestReservationsLoading,
  } = useGuestReservations(guestIdFromParams);

  if (isLoading || isGuestProfileLoading) {
    return <AppSkeleton />;
  }
  if (!guestIdFromParams) {
    notFound();
  }

  if (!guest) {
    notFound();
  }

  const guestReservations = guestReservationRows ?? [];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">{guest.firstName} {guest.lastName}</CardTitle>
          <CardDescription>Guest Profile</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Email</p>
              <p>{guest.email || "Not provided"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Phone</p>
              <p>{guest.phone || "Not provided"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Country</p>
              <p>{getCountryByCode(guest.country || "")?.name || guest.country || "Not provided"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">City</p>
              <p>{guest.city || "Not provided"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">State/Province/Region</p>
              <p>{guest.state || "Not provided"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Pincode</p>
              <p>{guest.pincode || "Not provided"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Address</p>
              <p>{guest.address || "Not provided"}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Reservation History</CardTitle>
          <CardDescription>
            A list of all reservations associated with this guest.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-2xl border border-border/40">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Booking ID</TableHead>
                  <TableHead>Room</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isGuestReservationsLoading && (
                  <TableRow>
                    <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
                      Loading reservations...
                    </TableCell>
                  </TableRow>
                )}
                {guestReservations.map(res => (
                  <TableRow key={res.id}>
                    <TableCell className="font-mono text-xs">{res.bookingId}</TableCell>
                    <TableCell>Room {res.roomNumber}</TableCell>
                    <TableCell>{res.status}</TableCell>
                  </TableRow>
                ))}
                {!isGuestReservationsLoading && guestReservations.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
                      No reservations found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

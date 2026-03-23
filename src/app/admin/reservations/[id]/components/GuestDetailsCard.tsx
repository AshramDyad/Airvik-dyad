"use client";

import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { Guest } from "@/data/types";
import { getCountryByCode } from "@/lib/countries";

interface GuestDetailsCardProps {
  guest?: Guest;
}

export function GuestDetailsCard({ guest }: GuestDetailsCardProps) {
  if (!guest) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Guest Information</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Guest details not found.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Guest Information</CardTitle>
        <CardDescription>
          Details of the primary guest for this reservation.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="flex justify-between items-start">
          <p className="font-semibold">Name</p>
          <span className="font-medium text-base">{guest.firstName} {guest.lastName}</span>
        </div>
        <div className="flex justify-between items-start">
          <p className="font-semibold">Email</p>
          <span>{guest.email || "Not provided"}</span>
        </div>
        <div className="flex justify-between items-start">
          <p className="font-semibold">Phone</p>
          <span>{guest.phone || "Not provided"}</span>
        </div>
        <div className="flex justify-between items-start">
          <p className="font-semibold">Country</p>
          <span>{getCountryByCode(guest.country || "")?.name || guest.country || "Not provided"}</span>
        </div>
        <div className="flex justify-between items-start">
          <p className="font-semibold">City</p>
          <span>{guest.city || "Not provided"}</span>
        </div>
        <div className="flex justify-between items-start">
          <p className="font-semibold">State</p>
          <span>{guest.state || "Not provided"}</span>
        </div>
        <div className="flex justify-between items-start">
          <p className="font-semibold">Pincode/Postal Code</p>
          <span>{guest.pincode || "Not provided"}</span>
        </div>
        <div className="flex justify-start gap-3">
          <div className="flex flex-col gap-1 min-w-[100px]">
            <p className="font-semibold">Address</p>
          </div>
          <span className="leading-relaxed">{guest.address || "Not provided"}</span>
        </div>
      </CardContent>
      <CardFooter className="border-t border-border/40 px-6 py-4">
        <Button variant="outline" size="sm" asChild>
          <Link href={`/admin/guests/${guest.id}`} prefetch={false}>View Guest Profile</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}

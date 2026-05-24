"use client";

import Link from "next/link";
import type { ReactNode } from "react";
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

type GuestDetail = {
  label: string;
  value: ReactNode;
  prominent?: boolean;
};

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

  const guestDetails: GuestDetail[] = [
    {
      label: "Name",
      value: `${guest.firstName} ${guest.lastName}`,
      prominent: true,
    },
    { label: "Email", value: guest.email || "Not provided" },
    { label: "Phone", value: guest.phone || "Not provided" },
    {
      label: "Country",
      value:
        getCountryByCode(guest.country || "")?.name ||
        guest.country ||
        "Not provided",
    },
    { label: "City", value: guest.city || "Not provided" },
    { label: "State", value: guest.state || "Not provided" },
    { label: "Postal Code", value: guest.pincode || "Not provided" },
    { label: "Address", value: guest.address || "Not provided" },
  ];

  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>Guest Information</CardTitle>
        <CardDescription>
          Details of the primary guest for this reservation.
        </CardDescription>
      </CardHeader>
      <CardContent className="text-sm">
        <dl className="space-y-4">
          {guestDetails.map((detail) => (
            <div key={detail.label} className="min-w-0 space-y-1">
              <dt className="font-semibold text-muted-foreground">
                {detail.label}
              </dt>
              <dd
                className={
                  detail.prominent
                    ? "min-w-0 break-words text-base font-medium leading-relaxed"
                    : "min-w-0 break-words leading-relaxed"
                }
              >
                {detail.value}
              </dd>
            </div>
          ))}
        </dl>
      </CardContent>
      <CardFooter className="border-t border-border/40 px-6 py-4">
        <Button variant="outline" size="sm" asChild>
          <Link href={`/admin/guests/${guest.id}`}>View Guest Profile</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}

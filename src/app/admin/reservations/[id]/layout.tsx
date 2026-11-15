"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { toast } from "sonner";
import { useAuthContext } from "@/context/auth-context";

// Page access only: the list and calendar intentionally remain available.
const BLOCKED_ACCOUNT_ID = "b5ebb779-da20-4f9b-ae52-33861fe3e185";

export default function ReservationPageLayout({ children }: { children: React.ReactNode }) {
  const { authUser, currentUser, isLoading } = useAuthContext();
  const pathname = usePathname();
  const userId = authUser?.id ?? currentUser?.id;
  const blocked = userId === BLOCKED_ACCOUNT_ID;

  React.useEffect(() => {
    if (!isLoading && blocked) {
      toast.error("Reservation not found.", { id: "reservation-not-found" });
    }
  }, [blocked, isLoading, pathname]);

  // Do not mount detail/edit loaders before the account has been resolved.
  if (isLoading || !userId) return null;
  if (blocked) {
    return <div role="alert" className="py-20 text-center text-muted-foreground">Reservation not found.</div>;
  }
  return <>{children}</>;
}

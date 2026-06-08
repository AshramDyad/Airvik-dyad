"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { AppSkeleton } from "@/components/layout/app-skeleton";
import { useSessionContext } from "@/context/session-context";
import { ADMIN_SHELL_ROLES } from "@/constants/roles";
import { getAdminLandingPath } from "@/lib/auth/landing";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { session, isLoading, roleName } = useSessionContext();
  const router = useRouter();

  React.useEffect(() => {
    if (!isLoading && session) {
      const isAdmin = ADMIN_SHELL_ROLES.some((adminRole) => adminRole === roleName);
      router.push(isAdmin ? getAdminLandingPath(roleName) : "/profile");
    }
  }, [session, roleName, isLoading, router]);

  // If a user is logged in, we are going to redirect.
  // Show a skeleton to prevent the login form from flashing.
  if (session) {
    return <AppSkeleton />;
  }

  // If there's no user, we show the login form.
  // We don't need to check for `isLoading` here, because even if we are
  // re-validating, we still want to show the form. Showing a skeleton
  // would unmount the form and lose the user's input.
  return <div>{children}</div>;
}

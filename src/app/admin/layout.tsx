"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { cn } from "@/lib/utils";
import { useAuthContext } from "@/context/auth-context";
import { useDataContext } from "@/context/data-context";
import { GeistSpinner } from "@/components/shared/vercel-spinner";
import { ADMIN_SHELL_ROLES } from "@/constants/roles";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminLayoutInner>{children}</AdminLayoutInner>;
}

function AdminLayoutInner({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = React.useState(false);
  const { currentUser, userRole, isLoading } = useAuthContext();
  const { isLoading: isDataLoading } = useDataContext();
  const router = useRouter();
  const pathname = usePathname();
  const isAuthRoute = pathname === "/admin/login" || pathname === "/admin/forget-password";

  React.useEffect(() => {
    if (isAuthRoute) return;
    if (isLoading) return;
    if (!currentUser) {
      router.replace("/admin/login");
      return;
    }
    const roleName = userRole?.name;
    const allowed = ADMIN_SHELL_ROLES.some((role) => role === roleName);
    if (!allowed) {
      router.replace("/profile");
    }
  }, [currentUser, userRole, isLoading, router]);

  const roleName = userRole?.name;
  const allowed = ADMIN_SHELL_ROLES.some((role) => role === roleName);
  if (!isAuthRoute && (!currentUser || !allowed)) {
    return null;
  }

  if (isAuthRoute) {
    return <div className="min-h-screen bg-background">{children}</div>;
  }

  return (
    <div
      className={cn(
        "grid min-h-screen overflow-hidden w-full bg-background transition-colors",
        isSidebarCollapsed
          ? "md:grid-cols-[72px_1fr]"
          : "md:grid-cols-[240px_1fr] lg:grid-cols-[288px_1fr]"
      )}
    >
      <Sidebar
        isCollapsed={isSidebarCollapsed}
        setIsCollapsed={setIsSidebarCollapsed}
      />
      <div className="flex h-screen min-w-0 flex-col bg-card/80 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <Header />
        <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto bg-transparent px-4 py-4 lg:px-8 lg:py-6">
            {isDataLoading ? (
              <div className="flex flex-1 items-center justify-center h-full">
                <GeistSpinner size={40} label="Loading data..." />
              </div>
            ) : (
              <div className="flex w-full min-w-0 flex-1 flex-col gap-6">{children}</div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

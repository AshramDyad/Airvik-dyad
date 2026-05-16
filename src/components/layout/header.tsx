"use client";

import Link from "next/link";
import {
  CircleUser,
  Menu,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useDataContext } from "@/context/data-context";
import { useAuthContext } from "@/context/auth-context";
import { ThemeToggle } from "../theme-toggle";
import { signOutUser } from "@/context/session-context";
import type { Permission } from "@/data/types";
import { getPermissionsForFeature, type PermissionFeature } from "@/lib/permissions/map";
import Image from "next/image";

type HeaderNavItem = {
  href: string;
  label: string;
  feature?: PermissionFeature;
  permissions?: Permission[];
};

const navItems: HeaderNavItem[] = [
  { href: "/admin", label: "Dashboard", feature: "dashboard" },
  { href: "/admin/reservations", label: "Reservations", feature: "reservations" },
  { href: "/admin/calendar", label: "Calendar", feature: "calendar" },
  { href: "/admin/housekeeping", label: "Housekeeping", feature: "housekeeping" },
  { href: "/admin/guests", label: "Guests", feature: "guests" },
  { href: "/admin/feedback", label: "Feedback", feature: "feedback" },
  { href: "/admin/reports", label: "Reports", feature: "reports" },
] satisfies HeaderNavItem[];

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { property } = useDataContext();
  const { currentUser, userRole, hasAnyPermission } = useAuthContext();
  const accessibleNavItems = navItems.filter(({ feature, permissions }) => {
    const featurePermissions = feature ? getPermissionsForFeature(feature) : [];
    const required = [...featurePermissions, ...(permissions ?? [])];
    if (required.length === 0) {
      return true;
    }
    return hasAnyPermission(required);
  });
  const activeNavItem = accessibleNavItems.find((item) => item.href === pathname);
  const pageTitle = activeNavItem?.label || "Dashboard";

  const handleLogout = async () => {
    await signOutUser();
    router.push("/admin/login");
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-border/50 px-4 shadow-sm lg:h-24 lg:px-8">
      <Sheet>
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 rounded-xl border border-border/40 hover:border-primary/40 bg-card/80 text-foreground shadow-sm transition-colors hover:text-primary md:hidden"
          >
            <Menu className="h-5 w-5" />
            <span className="sr-only">Toggle navigation menu</span>
          </Button>
        </SheetTrigger>
        <SheetContent
          side="left"
          className="flex flex-col gap-6 overflow-y-auto rounded-r-3xl border-border/50 bg-card/95 p-0 pb-8 pl-6 pr-4 shadow-lg backdrop-blur"
        >
          <nav className="flex flex-col gap-4">
            <div className="flex items-center gap-3 border-b border-border/50 p-2">
              <Link
              href="/"
              className="flex items-center gap-3 overflow-hidden text-foreground transition-colors focus-visible:outline-none"
            >
              <Image
                src="/logo.png"
                alt="admin-logo"
                height={160}
                width={160}
                quality={100}
              />
            </Link>
            </div>
            <div className="flex flex-col gap-2">
              {accessibleNavItems.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex items-center gap-3 rounded-2xl px-3 py-2.5 text-base font-medium text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-0"
                >
                  {label}
                </Link>
              ))}
            </div>
          </nav>
        </SheetContent>
      </Sheet>

      <div className="w-full flex-1 overflow-hidden">
        <div className="flex flex-col gap-1">
          <h1 className="truncate text-xl font-serif font-semibold tracking-tight text-foreground">
            {pageTitle}
          </h1>
          {property?.name && (
            <p className="text-sm text-muted-foreground">{property.name}</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-4">
        <ThemeToggle />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-xl border border-border/40 hover:border-primary/40 bg-card/80 text-foreground shadow-sm transition-colors hover:text-primary"
            >
              <CircleUser className="h-5 w-5" />
              <span className="sr-only">Toggle user menu</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-56 rounded-2xl border border-border/50 bg-card/95 p-2 shadow-lg backdrop-blur"
          >
            <DropdownMenuLabel className="text-sm font-serif font-semibold text-foreground">
              {currentUser ? currentUser.name : "No user"}
              <p className="text-xs font-normal text-muted-foreground">
                {userRole?.name}
              </p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-border/50" />
            <DropdownMenuItem
              onClick={handleLogout}
              className="rounded-xl px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
            >
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

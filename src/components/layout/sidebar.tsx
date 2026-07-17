"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronsLeft, Settings } from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/utils";
import { useAuthContext } from "@/context/auth-context";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { SidebarNavContent } from "@/components/layout/sidebar-nav-content";
import {
  ADMIN_NAV_ITEMS,
  canAccessNavItem,
  isNavPathActive,
  isNavSubItemActive,
} from "@/data/admin-nav";
import Image from "@/components/ui/cloudflare-image";

interface SidebarProps {
  isCollapsed: boolean;
  setIsCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
}

export function Sidebar({ isCollapsed, setIsCollapsed }: SidebarProps) {
  const pathname = usePathname() ?? "";
  const { hasPermission, hasAnyPermission } = useAuthContext();

  const accessibleNavItems = ADMIN_NAV_ITEMS.filter((item) =>
    canAccessNavItem(item, hasAnyPermission)
  );

  return (
    <aside className="hidden h-screen flex-col border-r border-border/50 bg-card/80 shadow-lg transition-colors duration-300 backdrop-blur supports-[backdrop-filter]:bg-card/60 md:flex">
      <TooltipProvider delayDuration={0}>
        <div
          className={cn(
            "flex h-16 items-center border-b border-border/50 px-4 lg:h-24 transition-all duration-300",
            isCollapsed ? "justify-center px-3" : "justify-between"
          )}
        >
          {!isCollapsed && (
            <Link
              href="/"
              className="flex items-center gap-3 overflow-hidden text-foreground transition-colors focus-visible:outline-none"
            >
              <Image
                src="/logo.png"
                alt="admin-logo"
                height={200}
                width={200}
              />
            </Link>
          )}
          <Button
            onClick={() => setIsCollapsed(!isCollapsed)}
            size="icon"
            variant="ghost"
            className={cn(
              "h-9 w-9 rounded-xl border border-border/40 hover:border-primary/40 bg-card/50 text-muted-foreground shadow-sm transition-colors hover:text-primary flex-shrink-0"
            )}
          >
            <ChevronsLeft
              className={cn(
                "h-4 w-4 transition-transform",
                isCollapsed && "rotate-180"
              )}
            />
            <span className="sr-only">Toggle sidebar</span>
          </Button>
        </div>

        {isCollapsed ? (
          <>
            <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-4">
              {accessibleNavItems.map((item) => {
                const { href, icon: Icon, label, subItems } = item;
                const isActive =
                  isNavPathActive(pathname, href) ||
                  (subItems?.some((sub) =>
                    isNavSubItemActive(pathname, sub)
                  ) ?? false);

                return (
                  <Tooltip key={href}>
                    <TooltipTrigger asChild>
                      <Link
                        href={href}
                        className={cn(
                          "relative flex h-11 w-11 items-center justify-center rounded-2xl text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary focus-visible:outline-none",
                          isActive && "bg-primary/10 text-primary shadow-sm"
                        )}
                      >
                        <Icon className="h-5 w-5" />
                        <span className="sr-only">{label}</span>
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent
                      side="right"
                      className="rounded-2xl border border-border/50 bg-card/90 px-3 py-2 text-sm font-medium text-foreground shadow-lg backdrop-blur"
                    >
                      {label}
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </nav>
            <div className="mt-auto border-t border-border/50 px-3 py-4">
              {hasPermission("update:setting") && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Link
                      href="/admin/settings"
                      className={cn(
                        "flex h-11 w-11 items-center justify-center rounded-2xl text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                        pathname === "/admin/settings" &&
                          "bg-primary/10 text-primary shadow-sm"
                      )}
                    >
                      <Settings className="h-5 w-5" />
                      <span className="sr-only">Settings</span>
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent
                    side="right"
                    className="rounded-2xl border border-border/50 bg-card/90 px-3 py-2 text-sm font-medium text-foreground shadow-lg backdrop-blur"
                  >
                    Settings
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          </>
        ) : (
          <SidebarNavContent />
        )}
      </TooltipProvider>
    </aside>
  );
}

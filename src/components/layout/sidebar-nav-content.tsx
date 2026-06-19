"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Settings } from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/utils";
import { useAuthContext } from "@/context/auth-context";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  ADMIN_NAV_ITEMS,
  canAccessNavItem,
  isNavPathActive,
  isNavSubItemActive,
} from "@/data/admin-nav";

interface SidebarNavContentProps {
  /** Called when a navigation link is clicked. Used by the mobile drawer to close itself. */
  onNavigate?: () => void;
  className?: string;
}

/**
 * Shared, expanded admin navigation: the full item list with collapsible
 * submenus plus the Settings footer. Rendered by both the desktop sidebar
 * (expanded state) and the mobile drawer, so the two never drift apart.
 */
export function SidebarNavContent({
  onNavigate,
  className,
}: SidebarNavContentProps) {
  const pathname = usePathname() ?? "";
  const { hasPermission, hasAnyPermission } = useAuthContext();
  const [openDropdowns, setOpenDropdowns] = React.useState<
    Record<string, boolean>
  >({});

  const accessibleNavItems = ADMIN_NAV_ITEMS.filter((item) =>
    canAccessNavItem(item, hasAnyPermission)
  );

  React.useEffect(() => {
    setOpenDropdowns((prev) => {
      const next = { ...prev } as Record<string, boolean>;
      ADMIN_NAV_ITEMS.forEach((item) => {
        item.subItems?.forEach((sub) => {
          if (sub.children && isNavSubItemActive(pathname, sub)) {
            next[sub.href] = true;
          }
        });
      });
      return next;
    });
  }, [pathname]);

  const toggleDropdown = (key: string) => {
    setOpenDropdowns((prev) => ({
      ...prev,
      [key]: !(prev[key] ?? false),
    }));
  };

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col", className)}>
      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-4">
        {accessibleNavItems.map((item) => {
          const { href, icon: Icon, label, subItems } = item;
          const isActive =
            isNavPathActive(pathname, href) ||
            (subItems?.some((sub) => isNavSubItemActive(pathname, sub)) ??
              false);

          if (subItems) {
            const visibleSubItems = subItems.filter((subItem) =>
              canAccessNavItem(subItem, hasAnyPermission)
            );
            if (visibleSubItems.length === 0) {
              return null;
            }
            return (
              <Collapsible
                key={href}
                defaultOpen={isActive}
                className="group/collapsible"
              >
                <CollapsibleTrigger asChild>
                  <Button
                    variant="ghost"
                    className={cn(
                      "flex w-full items-center justify-between gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-primary/5 hover:text-primary focus-visible:outline-none h-auto",
                      isActive && "text-primary"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="h-4 w-4" />
                      {label}
                    </div>
                    <ChevronRight className="h-4 w-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="ml-4 mt-1 flex flex-col gap-1 border-l border-border/50 pl-2">
                    {visibleSubItems.map((sub) => {
                      const hasChildren = Boolean(sub.children?.length);
                      const childItems = hasChildren
                        ? sub.children!.filter((child) =>
                            canAccessNavItem(child, hasAnyPermission)
                          )
                        : [];
                      const isSubActive = isNavSubItemActive(pathname, sub);
                      if (!hasChildren || childItems.length === 0) {
                        return (
                          <Link
                            key={sub.href}
                            href={sub.href}
                            onClick={onNavigate}
                            className={cn(
                              "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-primary/5 hover:text-primary",
                              pathname === sub.href &&
                                "bg-primary/10 text-primary"
                            )}
                          >
                            {sub.label}
                          </Link>
                        );
                      }

                      const isOpen = openDropdowns[sub.href] ?? isSubActive;
                      return (
                        <div key={sub.href} className="space-y-1">
                          <button
                            type="button"
                            onClick={() => toggleDropdown(sub.href)}
                            className={cn(
                              "flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-primary/5 hover:text-primary",
                              isSubActive && "text-primary"
                            )}
                          >
                            <span>{sub.label}</span>
                            <ChevronRight
                              className={cn(
                                "h-4 w-4 transition-transform",
                                isOpen && "rotate-90"
                              )}
                            />
                          </button>
                          {isOpen && (
                            <div className="ml-3 flex flex-col gap-1 border-l border-dashed border-border/50 pl-3">
                              {childItems.map((child) => (
                                <Link
                                  key={child.href}
                                  href={child.href}
                                  onClick={onNavigate}
                                  className={cn(
                                    "rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-primary/5 hover:text-primary",
                                    pathname === child.href &&
                                      "bg-primary/10 text-primary"
                                  )}
                                >
                                  {child.label}
                                </Link>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            );
          }

          return (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-primary/5 hover:text-primary focus-visible:outline-none",
                isActive && "bg-primary/10 text-primary shadow-sm"
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </nav>
      {hasPermission("update:setting") && (
        <div className="mt-auto border-t border-border/50 px-3 py-4">
          <Link
            href="/admin/settings"
            onClick={onNavigate}
            className={cn(
              "flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-primary/5 hover:text-primary focus-visible:outline-none",
              pathname === "/admin/settings" &&
                "bg-primary/10 text-primary shadow-sm"
            )}
          >
            <Settings className="h-4 w-4" />
            Settings
          </Link>
        </div>
      )}
    </div>
  );
}

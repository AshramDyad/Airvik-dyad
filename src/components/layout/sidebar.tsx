"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  Home,
  Calendar,
  Users,
  BedDouble,
  DollarSign,
  BarChart3,
  Settings,
  Package2,
  ClipboardList,
  Layers,
  FolderOpen,
  ChevronsLeft,
  ChevronRight,
  MessageSquare,
  HeartHandshake,
  History,
  Megaphone,
  Receipt,
} from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/utils";
import { useAuthContext } from "@/context/auth-context";
import { useDataContext } from "@/context/data-context";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { Permission } from "@/data/types";
import { ENGAGEMENT_SECTIONS } from "@/data/engagement-nav";
import {
  getPermissionsForFeature,
  type PermissionFeature,
} from "@/lib/permissions/map";
import Image from "next/image";

type SidebarChildItem = {
  label: string;
  href: string;
  feature?: PermissionFeature;
  permissions?: Permission[];
};

type SidebarSubItem = SidebarChildItem & {
  children?: readonly SidebarChildItem[];
};

type SidebarNavItem = {
  href: string;
  icon: LucideIcon;
  label: string;
  feature?: PermissionFeature;
  permissions?: Permission[];
  subItems?: SidebarSubItem[];
};

const engagementSubItems: SidebarSubItem[] = [
  {
    label: "Blog Posts",
    href: "/admin/posts",
    feature: "posts",
    children: ENGAGEMENT_SECTIONS.posts.items,
  },
  {
    label: "Event Promotions",
    href: "/admin/events",
    feature: "eventBanner",
    children: ENGAGEMENT_SECTIONS.events.items,
  },
  {
    label: "Guest Reviews",
    href: "/admin/reviews",
    feature: "reviews",
    children: ENGAGEMENT_SECTIONS.reviews.items,
  },
];

const navItems: SidebarNavItem[] = [
  { href: "/admin", icon: Home, label: "Dashboard", feature: "dashboard" },
  {
    href: "/admin/reservations",
    icon: Calendar,
    label: "Reservations",
    feature: "reservations",
  },
  {
    href: "/admin/calendar",
    icon: Calendar,
    label: "Calendar",
    feature: "calendar",
  },
  {
    href: "/admin/posts",
    icon: Megaphone,
    label: "Engagement",
    subItems: engagementSubItems,
  },
  {
    href: "/admin/housekeeping",
    icon: ClipboardList,
    label: "Housekeeping",
    feature: "housekeeping",
  },
  { href: "/admin/guests", icon: Users, label: "Guests", feature: "guests" },
  {
    href: "/admin/room-categories",
    icon: FolderOpen,
    label: "Room Categories",
    feature: "roomCategories",
  },
  {
    href: "/admin/room-types",
    icon: Layers,
    label: "Room Types",
    feature: "roomTypes",
  },
  { href: "/admin/rooms", icon: BedDouble, label: "Rooms", feature: "rooms" },
  {
    href: "/admin/rates",
    icon: DollarSign,
    label: "Rate Plans",
    feature: "ratePlans",
  },
  {
    href: "/admin/feedback",
    icon: MessageSquare,
    label: "Feedback",
    feature: "feedback",
  },
  {
    href: "/admin/reports",
    icon: BarChart3,
    label: "Reports",
    feature: "reports",
  },
  {
    href: "/admin/donations",
    icon: HeartHandshake,
    label: "Donations",
    feature: "donations",
  },
  {
    href: "/admin/manual-receipt",
    icon: Receipt,
    label: "Manual Receipt",
    feature: "donations",
  },
] satisfies SidebarNavItem[];

interface SidebarProps {
  isCollapsed: boolean;
  setIsCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
}

export function Sidebar({ isCollapsed, setIsCollapsed }: SidebarProps) {
  const pathname = usePathname() ?? "";
  const { hasPermission, hasAnyPermission } = useAuthContext();
  const { property } = useDataContext();
  const [openDropdowns, setOpenDropdowns] = React.useState<
    Record<string, boolean>
  >({});

  const canAccessItem = (
    item:
      | Pick<SidebarNavItem, "feature" | "permissions">
      | Pick<SidebarSubItem, "feature" | "permissions">
      | Pick<SidebarChildItem, "feature" | "permissions">
  ): boolean => {
    const featurePermissions = item.feature
      ? getPermissionsForFeature(item.feature)
      : [];
    const required = [...featurePermissions, ...(item.permissions ?? [])];
    if (required.length === 0) {
      return true;
    }
    return hasAnyPermission(required);
  };

  const isPathActive = (href: string): boolean => {
    if (!href) return false;
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const isExactPathActive = (href: string): boolean => pathname === href;

  const isSubItemActive = (subItem: SidebarSubItem): boolean => {
    if (isPathActive(subItem.href)) {
      return true;
    }
    if (subItem.children) {
      return subItem.children.some((child) => isPathActive(child.href));
    }
    return false;
  };

  const accessibleNavItems = navItems.filter(canAccessItem);
  if (canAccessItem({ feature: "activity" })) {
    accessibleNavItems.push({
      href: "/admin/activity",
      icon: History,
      label: "Activity",
      feature: "activity",
    });
  }

  React.useEffect(() => {
    setOpenDropdowns((prev) => {
      const next = { ...prev } as Record<string, boolean>;
      navItems.forEach((item) => {
        item.subItems?.forEach((sub) => {
          if (sub.children && isSubItemActive(sub)) {
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
              prefetch={false}
              className="flex items-center gap-3 overflow-hidden text-foreground transition-colors focus-visible:outline-none"
            >
              <Image
                src="/logo.png"
                alt="admin-logo"
                height={200}
                width={200}
                quality={100}
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
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-4">
          {accessibleNavItems.map((item) => {
            const { href, icon: Icon, label, subItems } = item;
            const isActive =
              isPathActive(href) ||
              (subItems?.some((sub) => isSubItemActive(sub)) ?? false);

            if (isCollapsed) {
              return (
                <Tooltip key={href}>
                  <TooltipTrigger asChild>
                    <Link
                      href={href}
                      prefetch={false}
                      className={cn(
                        "flex h-11 w-11 items-center justify-center rounded-2xl text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary focus-visible:outline-none",
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
            }

            if (subItems) {
              const visibleSubItems = subItems.filter((subItem) =>
                canAccessItem(subItem)
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
                              canAccessItem(child)
                            )
                          : [];
                        const isSubActive = isSubItemActive(sub);
                        if (!hasChildren || childItems.length === 0) {
                          return (
                            <Link
                              key={sub.href}
                              href={sub.href}
                              prefetch={false}
                              className={cn(
                                "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-primary/5 hover:text-primary",
                                isExactPathActive(sub.href) &&
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
                                    prefetch={false}
                                    className={cn(
                                      "rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-primary/5 hover:text-primary",
                                      isExactPathActive(child.href) &&
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
                prefetch={false}
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
        <div className="mt-auto border-t border-border/50 px-3 py-4">
          {hasPermission("update:setting") &&
            (isCollapsed ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link
                    href="/admin/settings"
                    prefetch={false}
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
            ) : (
              <Link
                href="/admin/settings"
                prefetch={false}
                className={cn(
                  "flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-primary/5 hover:text-primary focus-visible:outline-none",
                  pathname === "/admin/settings" &&
                    "bg-primary/10 text-primary shadow-sm"
                )}
              >
                <Settings className="h-4 w-4" />
                Settings
              </Link>
            ))}
        </div>
      </TooltipProvider>
    </aside>
  );
}

import type { LucideIcon } from "lucide-react";
import {
  Home,
  Calendar,
  Users,
  BedDouble,
  DollarSign,
  BarChart3,
  ClipboardList,
  Layers,
  FolderOpen,
  MessageSquare,
  HeartHandshake,
  History,
  Megaphone,
  Receipt,
  CreditCard,
  Landmark,
} from "lucide-react";

import type { Permission } from "@/data/types";
import { ENGAGEMENT_SECTIONS } from "@/data/engagement-nav";
import {
  getPermissionsForFeature,
  type PermissionFeature,
} from "@/lib/permissions/map";

export type SidebarChildItem = {
  label: string;
  href: string;
  feature?: PermissionFeature;
  permissions?: Permission[];
};

export type SidebarSubItem = SidebarChildItem & {
  children?: readonly SidebarChildItem[];
};

export type SidebarNavItem = {
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

export const ADMIN_NAV_ITEMS: SidebarNavItem[] = [
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
    href: "/admin/payments",
    icon: CreditCard,
    label: "Payments",
    feature: "payments",
    subItems: [
      {
        label: "Statement",
        href: "/admin/payments",
        feature: "payments",
      },
      {
        label: "Create Payment",
        href: "/admin/payments/create",
        feature: "payments",
      },
      {
        label: "Accounts",
        href: "/admin/payments/accounts",
        feature: "payments",
      },
      {
        label: "Settlements",
        href: "/admin/payments/settlements",
        feature: "settlements",
      },
    ],
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
  {
    href: "/admin/owner-overview",
    icon: Landmark,
    label: "Owner Overview",
    feature: "ownerOverview",
  },
  {
    href: "/admin/activity",
    icon: History,
    label: "Activity",
    feature: "activity",
  },
] satisfies SidebarNavItem[];

/**
 * Returns the page title for the current pathname based on the top-level nav
 * items (exact href match), falling back to "Dashboard". Mirrors the previous
 * inline lookup in the header.
 */
export function getAdminNavTitle(pathname: string): string {
  const match = ADMIN_NAV_ITEMS.find((item) => item.href === pathname);
  return match?.label ?? "Dashboard";
}

/** Whether the current user may see a nav item, given its required permissions. */
export function canAccessNavItem(
  item: Pick<SidebarNavItem, "feature" | "permissions">,
  hasAnyPermission: (permissions: Iterable<Permission>) => boolean
): boolean {
  const featurePermissions = item.feature
    ? getPermissionsForFeature(item.feature)
    : [];
  const required = [...featurePermissions, ...(item.permissions ?? [])];
  if (required.length === 0) {
    return true;
  }
  return hasAnyPermission(required);
}

/** Active if the pathname equals the href or is nested under it. */
export function isNavPathActive(pathname: string, href: string): boolean {
  if (!href) return false;
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** A sub-item is active if it (or any of its children) matches the pathname. */
export function isNavSubItemActive(
  pathname: string,
  subItem: SidebarSubItem
): boolean {
  if (isNavPathActive(pathname, subItem.href)) {
    return true;
  }
  if (subItem.children) {
    return subItem.children.some((child) =>
      isNavPathActive(pathname, child.href)
    );
  }
  return false;
}

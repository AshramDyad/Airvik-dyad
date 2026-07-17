"use client";

import Link from "next/link";
import { CircleUser, Menu } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import * as React from "react";

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
import { SidebarNavContent } from "@/components/layout/sidebar-nav-content";
import { getAdminNavTitle } from "@/data/admin-nav";
import { useDataContext } from "@/context/data-context";
import { useAuthContext } from "@/context/auth-context";
import { ThemeToggle } from "../theme-toggle";
import { signOutUser } from "@/context/session-context";
import Image from "@/components/ui/cloudflare-image";

export function Header() {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const { property, roles } = useDataContext();
  const { currentUser } = useAuthContext();
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);
  const pageTitle = getAdminNavTitle(pathname);
  const userRole = roles.find((r) => r.id === currentUser?.roleId);

  const handleLogout = async () => {
    await signOutUser();
    router.push("/admin/login");
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-border/50 px-4 shadow-sm lg:h-24 lg:px-8">
      <Sheet open={isMenuOpen} onOpenChange={setIsMenuOpen}>
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
          className="flex h-full flex-col gap-0 rounded-r-3xl border-border/50 bg-card/95 p-0 shadow-lg backdrop-blur"
        >
          <div className="flex shrink-0 items-center gap-3 border-b border-border/50 px-6 py-2">
            <Link
              href="/"
              onClick={() => setIsMenuOpen(false)}
              className="flex items-center gap-3 overflow-hidden text-foreground transition-colors focus-visible:outline-none"
            >
              <Image
                src="/logo.png"
                alt="admin-logo"
                height={160}
                width={160}
              />
            </Link>
          </div>
          <SidebarNavContent onNavigate={() => setIsMenuOpen(false)} />
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

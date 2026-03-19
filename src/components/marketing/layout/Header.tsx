"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Menu, ChevronDown, MapPin } from "lucide-react";
import { FaRegCalendarCheck, FaWhatsapp } from "react-icons/fa6";
import type { Property } from "@/data/types";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { FaRegCalendarAlt } from "react-icons/fa";
import { FiPhone } from "react-icons/fi";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/book", label: "Rooms" },
  // { href: "/donate", label: "Donate" },
  {
    label: "About Us",
    subLinks: [
      { href: "/about-us", label: "About Ashram" },
      { href: "/sunil-bhagat", label: "About Sunil Bhagat" },
      { href: "/about-rishikesh", label: "About Rishikesh" },
    ],
  },
  { href: "/shop", label: "Shop" },
  { href: "/amenities", label: "Amenities" },
  { href: "/ashram-glimpse", label: "Ashram Glimpse" },
  // { href: "/journey", label: "Our Journey" },
  // { href: "/feedback", label: "Feedback" },
];

const whatsappNumber = "918595251312";
const whatsappMessage = encodeURIComponent(
  "Hi! I'd like to know more about staying at Swaminarayan Ashram.",
);
const whatsappContactUrl = `https://wa.me/${whatsappNumber}?text=${whatsappMessage}`;

type HeaderProps = {
  propertyLocation: Pick<Property, "address" | "google_maps_url">;
};

export function Header({ propertyLocation }: HeaderProps) {
  const [isLocationDialogOpen, setIsLocationDialogOpen] = React.useState(false);
  const locationSrc = propertyLocation.google_maps_url?.trim() ?? "";
  const addressText =
    propertyLocation.address?.trim() ||
    "View the property location on the map.";
  const hasLocationMap = locationSrc.length > 0;

  return (
    <>
      <header className="border-b border-border bg-white sticky top-0 z-40 w-full">
        {/* topbar content */}
        <div className="hidden md:block bg-primary-hover">
          <div className="container mx-auto flex h-14 items-center justify-between px-4">
            <p className="text-sm font-medium text-white/90">
              Swaminarayan Ashram (Estd: 2002)
            </p>
            <div className="flex items-center space-x-4">
              {/* contact number add */}
              <a
                href="tel:+918595251312"
                className="text-sm font-medium text-white/90 flex items-center gap-1.5 hover:text-white transition-colors"
              >
                <FiPhone className="size-5" aria-hidden="true" />
                +91 8595251312
              </a>

              <span className="text-sm font-medium text-white/90">&#124;</span>

              <a
                href="tel:+918511151708"
                className="text-sm font-medium text-white/90 flex items-center gap-1.5 hover:text-white transition-colors"
              >
                +91 85111 51708
              </a>

              {hasLocationMap ? (
                <button
                  type="button"
                  aria-label="Open property location map"
                  onClick={() => setIsLocationDialogOpen(true)}
                  className="text-sm font-medium text-white/90 flex items-center gap-1.5 hover:text-white transition-colors"
                >
                  <MapPin className="size-5" aria-hidden="true" />
                  Location
                </button>
              ) : null}

              {/* event button */}
              <Button
                asChild
                className="bg-primary/40 hover:bg-primary/60 capitalize text-primary-foreground justify-center text-center gap-2"
              >
                <Link href="/events">
                  {" "}
                  <FaRegCalendarAlt />
                  Events
                </Link>
              </Button>
            </div>
          </div>
        </div>

        {/* Main Header */}
        <div className="container mx-auto flex h-20 items-center justify-between px-4 text-foreground xl:h-24">
          <Link
            href="/"
            className="flex items-center shrink-0 focus-visible:outline-none"
          >
            {/* Header-logo */}
            <Image
              src="/logo.png"
              alt="SahajAnand Wellness Logo"
              width={360}
              height={160}
              quality={100}
              priority
              sizes="(max-width: 640px) 128px, (max-width: 1024px) 176px, (max-width: 1280px) 208px, 240px"
              className="h-auto w-44 xl:w-56 max-w-full"
            />
          </Link>
          <nav className="hidden xl:flex space-x-1 self-stretch">
            <NavigationMenu>
              <NavigationMenuList>
                {navLinks.map((link) => (
                  <NavigationMenuItem key={link.label}>
                    {link.subLinks ? (
                      <>
                        <NavigationMenuTrigger className="relative inline-flex items-center rounded-2xl px-4 py-2 text-lg font-medium text-primary-hover bg-transparent hover:bg-primary/15 hover:text-primary focus-visible:outline-none data-[state=open]:bg-primary/15 data-[state=open]:text-primary after:absolute after:left-0 after:right-0 after:-bottom-5 after:h-3 after:content-['']">
                          {link.label}
                        </NavigationMenuTrigger>
                        <NavigationMenuContent>
                          <ul className="grid w-[240px] gap-1 p-2">
                            {link.subLinks.map((subLink) => (
                              <ListItem
                                key={subLink.label}
                                href={subLink.href}
                                title={subLink.label}
                              />
                            ))}
                          </ul>
                        </NavigationMenuContent>
                      </>
                    ) : (
                      <NavigationMenuLink asChild>
                        <Link
                          href={link.href || "#"}
                          className="inline-flex items-center rounded-2xl px-4 py-2 text-lg font-medium text-primary-hover bg-transparent hover:bg-primary/15 hover:text-primary focus-visible:outline-none"
                        >
                          {link.label}
                        </Link>
                      </NavigationMenuLink>
                    )}
                  </NavigationMenuItem>
                ))}
              </NavigationMenuList>
            </NavigationMenu>
          </nav>
          <div className="hidden xl:flex items-center gap-3">
            <Button
              asChild
              className="bg-primary hover:bg-primary-hover capitalize text-primary-foreground justify-center text-center gap-2"
            >
              <Link href="/book">
                {" "}
                <FaRegCalendarCheck className="size-4" />
                book now
              </Link>
            </Button>
            <Button
              asChild
              className="bg-[#1ba74e] text-white hover:bg-[#147c39] font-semibold capitalize gap-2"
            >
              <a
                href={whatsappContactUrl}
                aria-label="Contact us on WhatsApp"
                rel="noopener noreferrer"
              >
                <FaWhatsapp className="h-4 w-4" aria-hidden="true" />
                Whatapp
              </a>
            </Button>
          </div>
          <div className="xl:hidden">
            <Sheet>
              <SheetTrigger asChild>
                {/* menu button */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-primary-hover focus-visible:outline-none"
                >
                  <Menu className="h-6 w-6" />
                </Button>
              </SheetTrigger>
              <SheetContent
                side="right"
                className="bg-background text-foreground z-[1100] w-full max-w-none border-none flex h-full flex-col"
              >
                <nav className="flex flex-1 flex-col space-y-2 mt-8">
                  {navLinks.map((link) =>
                    link.subLinks ? (
                      <Collapsible key={link.label} className="w-full">
                        <CollapsibleTrigger className="flex justify-between items-center w-full text-lg font-medium hover:text-primary py-2 focus-visible:outline-none [&[data-state=open]>svg]:rotate-180">
                          {link.label}
                          <ChevronDown className="h-5 w-5 transition-transform" />
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="pl-4 mt-2 space-y-3 border-l-2 border-border ml-2">
                            {link.subLinks.map((subLink) => (
                              <SheetClose asChild key={subLink.label}>
                                <Link
                                  href={subLink.href}
                                  className="block text-base text-muted-foreground hover:text-primary focus-visible:outline-none"
                                >
                                  {subLink.label}
                                </Link>
                              </SheetClose>
                            ))}
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    ) : (
                      <SheetClose asChild key={link.label}>
                        <Link
                          href={link.href}
                          className="text-lg font-medium hover:text-primary py-2 focus-visible:outline-none"
                        >
                          {link.label}
                        </Link>
                      </SheetClose>
                    ),
                  )}
                </nav>
                <div className="mt-8 flex w-full flex-col gap-3">
                  {hasLocationMap ? (
                    <SheetClose asChild>
                      <button
                        type="button"
                        aria-label="Open property location map"
                        onClick={() => setIsLocationDialogOpen(true)}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-primary/20 bg-primary/5 px-4 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none"
                      >
                        <MapPin className="h-4 w-4" aria-hidden="true" />
                        View Location
                      </button>
                    </SheetClose>
                  ) : null}
                  <SheetClose asChild>
                    <Button
                      asChild
                      className="bg-primary hover:bg-primary-hover text-primary-foreground flex w-full justify-center text-center gap-2"
                    >
                      <Link href="/book">
                        <FaRegCalendarCheck className="h-4 w-4" />
                        Book Now
                      </Link>
                    </Button>
                  </SheetClose>
                  <SheetClose asChild>
                    <Button
                      asChild
                      className="bg-[#1ba74e] text-white hover:bg-[#147c39] font-semibold capitalize gap-2"
                    >
                      <a
                        href={whatsappContactUrl}
                        aria-label="Contact us on WhatsApp"
                        rel="noopener noreferrer"
                      >
                        <FaWhatsapp className="h-4 w-4" aria-hidden="true" />
                        Ashram Connect
                      </a>
                    </Button>
                  </SheetClose>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>
      {hasLocationMap ? (
        <Dialog
          open={isLocationDialogOpen}
          onOpenChange={setIsLocationDialogOpen}
        >
          <DialogContent className="max-w-[95vw] overflow-hidden p-0 md:max-w-4xl">
            <DialogHeader className="border-b border-border/40 px-6 py-5">
              <DialogTitle>Property Location</DialogTitle>
              <DialogDescription>{addressText}</DialogDescription>
            </DialogHeader>
            <div className="aspect-video w-full">
              <iframe
                src={locationSrc}
                width="100%"
                height="100%"
                style={{ border: 0 }}
                allowFullScreen={false}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title="Property location map"
              ></iframe>
            </div>
          </DialogContent>
        </Dialog>
      ) : null}
    </>
  );
}

const ListItem = React.forwardRef<
  React.ElementRef<typeof Link>,
  React.ComponentPropsWithoutRef<typeof Link>
>(({ className, title, ...props }, ref) => {
  return (
    <li>
      <NavigationMenuLink asChild>
        <Link
          ref={ref}
          className={cn(
            "block select-none rounded-2xl px-4 py-3 leading-none no-underline outline-none hover:bg-primary/15 hover:text-primary focus-visible:outline-none",
            className,
          )}
          {...props}
        >
          <div className="text-base leading-none text-primary-hover hover:text-primary">
            {title}
          </div>
        </Link>
      </NavigationMenuLink>
    </li>
  );
});
ListItem.displayName = "ListItem";

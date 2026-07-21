"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CalendarCheck, Bed, ChevronRight } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { useDataContext } from "@/context/data-context";
import { cn } from "@/lib/utils";
import { trackEvent } from "@/lib/analytics";

const featuredRoomMatchers = [
  {
    label: "Brahmbhoj",
    subtitle: "Semi Deluxe",
    match: "Brahmbhoj",
  },
  {
    label: "AnnaDaan",
    subtitle: "Premium Room",
    match: "AnnaDaan",
  },
  {
    label: "Havan Donation",
    subtitle: "Economy",
    match: "Havan",
  },
  {
    label: "Ganga Aarti",
    subtitle: "Ganga Darshan",
    match: "Ganga",
  },
];

export function StickyBookingButton() {
  const pathname = usePathname();
  const { roomTypes } = useDataContext();
  const [isOpen, setIsOpen] = React.useState(false);
  const visibleRoomTypes = React.useMemo(
    () => (roomTypes ?? []).filter((roomType) => roomType.isVisible !== false),
    [roomTypes]
  );

  const isAdminRoute = React.useMemo(() => {
    return pathname?.startsWith("/admin");
  }, [pathname]);

  const rooms = React.useMemo(() => {
    if (visibleRoomTypes.length === 0) {
      return featuredRoomMatchers.map((room) => ({
        name: room.label,
        subtitle: room.subtitle,
        href: "/book",
      }));
    }

    return featuredRoomMatchers.map((room) => {
      const matchedRoomType = visibleRoomTypes.find((roomType) =>
        roomType.name.toLowerCase().startsWith(room.match.toLowerCase())
      );

      return {
        name: room.label,
        subtitle: room.subtitle,
        href: matchedRoomType ? `/book/rooms/${matchedRoomType.id}` : "/book",
      };
    });
  }, [visibleRoomTypes]);

  if (isAdminRoute) {
    return null;
  }

  return (
    <div className="fixed top-1/2 right-0 z-50 -translate-y-1/2 hidden sm:block">
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            className={cn(
              "h-auto w-auto rounded-l-xl rounded-r-none hover:bg-primary-hover px-2.5 py-5 shadow-sm capitalize",
              isOpen && "shadow-2xl"
            )}
            aria-label="Open booking panel"
            style={{ writingMode: "vertical-rl" }}
          >
            book now
          </Button>
        </PopoverTrigger>
        <PopoverContent
          side="left"
          align="center"
          sideOffset={12}
          className="w-[min(90vw,360px)] z-[1003] p-0 shadow-2xl border-border/30 bg-background rounded-xl"
        >
          <div className="flex flex-col max-h-[min(80vh,600px)]">
            <div className="p-4 border-b border-border/50 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-primary/10">
                  <CalendarCheck className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-serif font-bold text-foreground">
                    Book Your Stay
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Choose your perfect room
                  </p>
                </div>
              </div>
            </div>

            <div className="p-4 overflow-y-auto flex-1">
              <div className="space-y-1.5">
                {rooms.map((room, index) => (
                  <React.Fragment key={room.name}>
                    <Link
                      href={room.href}
                      onClick={() => {
                        trackEvent("book_click", {
                          location: "sticky_room",
                          room: room.name,
                        });
                        setIsOpen(false);
                      }}
                      className="group flex items-center justify-between gap-3 p-3 rounded-xl hover:bg-primary/5 border border-transparent hover:border-primary/40 transition-all duration-200 outline-none focus:outline-none focus-visible:outline-none"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="bg-primary/10 text-primary p-2.5 rounded-lg flex-shrink-0">
                          <Bed className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-1">
                            {room.name}
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {room.subtitle}
                          </div>
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground/80 group-hover:text-primary group-hover:translate-x-1 transition-all duration-200 flex-shrink-0" />
                    </Link>
                    {index < rooms.length - 1 && (
                      <Separator className="my-1.5 opacity-50" />
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>

            <div className="p-4 border-t border-border/50 flex-shrink-0">
              <Button 
                asChild 
                size="lg" 
                className="w-full font-semibold"
              >
                <Link
                  href="/book"
                  onClick={() => {
                    trackEvent("book_click", { location: "sticky_all_rooms" });
                    setIsOpen(false);
                  }}
                >
                  View All Rooms
                </Link>
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

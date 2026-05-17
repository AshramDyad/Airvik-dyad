"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { Users } from "lucide-react";
import { format } from "date-fns";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { RoomType } from "@/data/types";
import { Icon } from "@/components/shared/icon";
import { useDataContext } from "@/context/data-context";
import type { EnhancedBookingSearchFormValues } from "./booking-widget";
import { useCurrencyFormatter } from "@/hooks/use-currency";
import { getRoomTypeImageUrl } from "@/lib/room-type-images";

// Legacy type for backward compatibility
type BookingSearchFormValues = {
  dateRange: {
    from?: Date;
    to?: Date;
  } | undefined;
  guests: number;
  children: number;
  rooms: number;
};

interface RoomTypeCardProps {
  roomType: RoomType;
  price: number;
  onSelect: (roomType: RoomType) => void;
  isSelectionComplete: boolean;
  hasSearched: boolean;
  searchValues?: BookingSearchFormValues | EnhancedBookingSearchFormValues | null;
}

export function RoomTypeCard({
  roomType,
  price,
  onSelect,
  isSelectionComplete,
  hasSearched,
  searchValues,
}: RoomTypeCardProps) {
  const { amenities: allAmenities } = useDataContext();
  const formatCurrency = useCurrencyFormatter();
  const imageUrl = React.useMemo(() => getRoomTypeImageUrl(roomType), [roomType]);

  const detailsLink = React.useMemo(() => {
    const baseUrl = `/book/rooms/${roomType.id}`;
    
    if (hasSearched && searchValues?.dateRange?.from && searchValues?.dateRange?.to) {
      // Check if we're dealing with enhanced or legacy search values
      const isEnhanced = 'roomOccupancies' in searchValues;
      
      let guests: number;
      let children: number;
      let rooms: number;
      
      if (isEnhanced) {
        // Calculate totals from roomOccupancies array
        const enhancedValues = searchValues as EnhancedBookingSearchFormValues;
        rooms = enhancedValues.roomOccupancies.length;
        guests = enhancedValues.roomOccupancies.reduce((sum, occ) => sum + occ.adults, 0);
        children = enhancedValues.roomOccupancies.reduce((sum, occ) => sum + occ.children, 0);
      } else {
        // Use legacy values directly
        const legacyValues = searchValues as BookingSearchFormValues;
        guests = legacyValues.guests;
        children = legacyValues.children;
        rooms = legacyValues.rooms;
      }
      
      const params = new URLSearchParams({
        from: format(searchValues.dateRange.from, "yyyy-MM-dd"),
        to: format(searchValues.dateRange.to, "yyyy-MM-dd"),
        guests: guests.toString(),
        children: children.toString(),
        rooms: rooms.toString(),
      });
      return `${baseUrl}?${params.toString()}`;
    }
    
    return baseUrl;
  }, [roomType.id, hasSearched, searchValues]);

  const resolvedAmenities = (roomType.amenities || [])
    .map((id) => allAmenities.find((a) => a.id === id))
    .filter((a): a is { id: string; name: string; icon: string } => !!a);

  const truncatedName = roomType.name
    .split(/\s+/)
    .slice(0, 5)
    .join(" ");

  const formattedPrice = formatCurrency(price, { maximumFractionDigits: 0 });

  const isSelectable = hasSearched && !isSelectionComplete;

  const handleCardClick = () => {
    if (isSelectable) {
      onSelect(roomType);
    }
  };

  const handleCardKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!isSelectable) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect(roomType);
    }
  };

  const handleLinkClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (isSelectable) {
      event.stopPropagation();
    }
  };

  // Card view
  return (
    <Card
      className={`flex flex-col border border-border/40 bg-transparent duration-300 group overflow-hidden rounded-2xl shadow-lg ${
        isSelectable ? "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60" : ""
      }`}
      role={isSelectable ? "button" : undefined}
      tabIndex={isSelectable ? 0 : undefined}
      onClick={handleCardClick}
      onKeyDown={handleCardKeyDown}
    >
      <CardHeader className="p-0">
        <Link
          href={detailsLink}
          className="block"
          onClick={handleLinkClick}
        >
          <div className="relative h-32 md:h-40 overflow-hidden">
            <Image
              src={imageUrl}
              alt={roomType.name}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
            />
            {/* {hasSearched && (
              <div className="absolute top-4 left-4">
                <Badge variant="secondary" className="bg-green-500/90 text-white border-none">
                  <Check className="h-3.5 w-3.5 mr-1" />
                  Available
                </Badge>
              </div>
            )} */}

            <div className="absolute top-4 right-4 flex items-center gap-1.5 rounded-full bg-[#ffffffcc] px-3 py-1 text-xs font-medium text-foreground shadow-md">
              <span className="font-serif">{roomType.bedTypes.join(", ")}</span>
            </div>

          </div>
        </Link>
      </CardHeader>
      <div className="flex flex-col flex-1 bg-white">
        <div className="flex flex-col p-4 pb-2 gap-1">
          <div className="flex items-start justify-between gap-4">
            <CardTitle className="text-foreground font-serif text-sm leading-tight line-clamp-2">
              <Link
                href={detailsLink}
                className="block leading-tight line-clamp-2 transition-colors"
                onClick={handleLinkClick}
              >
                {truncatedName}
              </Link>
            </CardTitle>
          </div>
          <CardDescription className="text-sm text-muted-foreground truncate">
            {roomType.description
              .split(/\s+/)
              .slice(0, 8)
              .join(" ")}
          </CardDescription>
          {/* <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Users className="h-4 w-4 text-primary/60" />
              <span>Up to {roomType.maxOccupancy} guests</span>
            </div>
          </div> */}
          {/* <div className="flex items-center gap-1.5">
              <Bed className="h-4 w-4 text-primary/60" />
              <span>{roomType.bedTypes.join(", ")}</span>
            </div> */}

        </div>
        <CardFooter className="flex-col items-stretch gap-1 px-4 pb-4 pt-0 bg-white">
          {resolvedAmenities.length > 0 && (
            <TooltipProvider delayDuration={0}>
              <div className="flex gap-4 justify-between">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  {/* <div className="flex items-center gap-1.5"> */}
                  <Users className="h-4 w-4" />
                  <span>Up to {roomType.maxOccupancy} guests</span>
                  {/* </div> */}
                </div>
                <div className="flex gap-4">
                  {resolvedAmenities.slice(0, 3).map((amenity) => (
                    <Tooltip key={amenity.id}>
                      <TooltipTrigger asChild>
                        <span className="inline-flex items-center justify-center text-muted-foreground transition-transform hover:scale-105">
                          <Icon name={amenity.icon} className="h-4 w-4" aria-hidden />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent
                        side="top"
                        className="bg-white text-foreground border border-border/40 rounded-xl shadow-lg px-3 py-2 text-sm font-medium"
                      >
                        {amenity.name}
                      </TooltipContent>
                    </Tooltip>
                  ))}
                </div>
              </div>
            </TooltipProvider>
          )}
          {resolvedAmenities.length === 0 && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="h-4 w-4" />
              <span>Up to {roomType.maxOccupancy} guests</span>
            </div>
          )}
          <div className="flex items-center pt-1 gap-1">
            <div className="text-sm font-bold">{formattedPrice}</div>
            <div className="text-sm text-muted-foreground">for per night</div>
          </div>
        </CardFooter>
      </div>
    </Card>
  );
}

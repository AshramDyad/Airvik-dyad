"use client";

import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useRoomTypePreview } from "@/hooks/use-room-type-preview";
import type { RoomTypePreview } from "@/lib/room-types/preview";
import {
  Card,
  CardContent,
  CardDescription,
  CardTitle,
} from "@/components/ui/card";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { Icon } from "@/components/shared/icon";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type AmenityIconsProps = {
  amenities: RoomTypePreview["amenities"];
  gapClass: string;
};

function AmenityIcons({ amenities, gapClass }: AmenityIconsProps) {
  return (
    <div className={`flex flex-wrap ${gapClass}`}>
      {amenities.map((amenity) => (
        <TooltipProvider key={amenity.id}>
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <div className="h-5 w-7 cursor-pointer">
                <Icon name={amenity.icon} className="h-4 w-4 text-muted-foreground" />
              </div>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs bg-white text-foreground border border-border">
              <div className="flex items-center justify-center gap-2 text-center">
                <span>{amenity.name}</span>
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ))}
    </div>
  );
}

export function RoomsShowcaseSection() {
  const { roomTypes } = useRoomTypePreview();
  const roomsToDisplay = roomTypes;

  return (
    <section className="bg-background py-10 sm:py-12">
      <div className="container mx-auto px-4">
        <div className="space-y-4 text-center">
          <h2 className="2xl:text-5xl md:text-4xl text-3xl font-bold text-foreground">
            Your Sacred Stay
          </h2>
          <p className="text-base text-muted-foreground md:text-lg max-w-3xl mx-auto">
          Sanctified spaces for every devotee’s stay.
          </p>
        </div>

        <div className="relative lg:hidden mt-12">
          <Carousel opts={{ align: "start", loop: true }} className="w-full">
            <CarouselContent className="-ml-4">
              {roomsToDisplay.map((room) => (
                <CarouselItem
                    key={room.id}
                    className="pl-4 basis-full sm:basis-3/4 md:basis-1/2 lg:basis-1/3"
                  >
                    <div className="h-full">
                      <Card className="flex h-full flex-col overflow-hidden bg-card rounded-2xl">
                        <div className="relative aspect-[3/2] w-full h-40">
                          <Image
                            src={room.imageUrl}
                            alt={room.name}
                            fill
                            className="rounded-t-2xl object-cover"
                            priority={false}
                            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                          />
                        </div>
                        <CardContent className="flex flex-1 flex-col gap-4 p-4 bg-white">
                          <div className="overflow-hidden">
                            <CardTitle className="text-lg font-serif font-semibold truncate">
                              {room.name}
                            </CardTitle>
                          </div>
                          <CardDescription className="text-sm text-muted-foreground line-clamp-1">
                            {room.description}
                          </CardDescription>
                          <AmenityIcons
                            amenities={room.amenities}
                            gapClass="gap-2"
                          />
                          <Button asChild className="mt-auto w-full bg-primary hover:bg-primary-hover">
                            <Link href={`/book/rooms/${room.id}`}>Book Now</Link>
                          </Button>
                        </CardContent>
                      </Card>
                    </div>
                  </CarouselItem>
              ))}
            </CarouselContent>
            <CarouselPrevious className="absolute left-2 top-[46%] -translate-y-1/2 -translate-x-1/2 rounded-full h-8 w-8  bg-card border-2 border-primary text-primary hover:bg-primary hover:text-primary-foreground z-10" />
            <CarouselNext className="absolute right-2 top-[46%] -translate-y-1/2 translate-x-1/2 rounded-full h-8 w-8  bg-card border-2 border-primary text-primary hover:bg-primary hover:text-primary-foreground z-10" />
          </Carousel>
        </div>
        <div className="relative mt-12 hidden lg:block">
          <div className="grid grid-cols-4 gap-6">
            {roomsToDisplay.map((room) => (
              <div key={room.id} className="h-full">
                <Card className="flex h-full flex-col overflow-hidden bg-card rounded-2xl">
                  <div className="relative aspect-[3/2] w-full h-40">
                    <Image
                      src={room.imageUrl}
                      alt={room.name}
                      fill
                      className="rounded-t-2xl object-cover"
                      priority={false}
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                    />
                  </div>
                  <CardContent className="flex flex-1 flex-col gap-4 p-4 bg-white">
                    <div className="overflow-hidden">
                      <CardTitle className="text-lg font-serif font-semibold truncate">
                        {room.name}
                      </CardTitle>
                    </div>
                    <CardDescription className="text-sm text-muted-foreground line-clamp-1">
                      {room.description}
                    </CardDescription>
                    <AmenityIcons
                      amenities={room.amenities}
                      gapClass="gap-2"
                    />
                    <Button asChild className="mt-auto w-full bg-primary hover:bg-primary-hover">
                      <Link href={`/book/rooms/${room.id}`}>Book Now</Link>
                    </Button>
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

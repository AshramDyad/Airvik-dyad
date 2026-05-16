"use client";

import Image from "next/image";

import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel";

interface RoomPhotoCarouselProps {
  photos: string[];
  roomName: string;
}

export function RoomPhotoCarousel({ photos, roomName }: RoomPhotoCarouselProps) {
  return (
    <div className="relative group">
      <Carousel className="w-full">
        <CarouselContent>
          {photos.map((photo, index) => (
            <CarouselItem key={index}>
              <div className="aspect-video relative rounded-lg overflow-hidden">
                <Image
                  src={photo}
                  alt={`${roomName} photo ${index + 1}`}
                  fill
                  className="object-cover"
                  sizes="100vw"
                />
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>
    </div>
  );
}

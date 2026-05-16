"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { notFound, useParams } from "next/navigation";
import { MapPin, Star, Share2, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useDataContext } from "@/context/data-context";
import { useRoomTypeDetail } from "@/hooks/use-room-type-detail";
import { RoomDetailsSkeleton } from "@/components/public/room-details-skeleton";

const RoomTypeCard = dynamic(
  () =>
    import("@/components/public/room-type-card").then(
      (module) => module.RoomTypeCard,
    ),
  {
    loading: () => <div className="h-72 rounded-2xl bg-muted/30" />,
  },
);

const ShareDialog = dynamic(
  () =>
    import("@/components/public/share-dialog").then(
      (module) => module.ShareDialog,
    ),
  { ssr: false },
);

const RoomBookingPanel = dynamic(
  () =>
    import("./components/room-booking-panel").then(
      (module) => module.RoomBookingPanel,
    ),
  {
    loading: () => (
      <div className="lg:col-span-2 mt-8 lg:mt-0 rounded-xl border border-gray-100 bg-white p-6 shadow-lg">
        <div className="h-80 rounded-xl bg-muted/30" />
      </div>
    ),
  },
);

const RoomAmenitiesSection = dynamic(
  () =>
    import("./components/room-amenities-section").then(
      (module) => module.RoomAmenitiesSection,
    ),
  {
    loading: () => <div className="h-64 rounded-xl bg-muted/30" />,
  },
);

const RoomPhotoCarousel = dynamic(
  () =>
    import("./components/room-photo-carousel").then(
      (module) => module.RoomPhotoCarousel,
    ),
  {
    loading: () => <div className="aspect-video rounded-lg bg-muted/30" />,
  },
);

const RoomPoliciesAccordion = dynamic(
  () =>
    import("./components/room-policies-accordion").then(
      (module) => module.RoomPoliciesAccordion,
    ),
  {
    loading: () => <div className="h-40 rounded-lg bg-muted/30" />,
  },
);

export function RoomDetailClient() {
  const params = useParams<{ id: string }>();
  const roomTypeIdFromParams = React.useMemo(() => {
    if (!params) return "";
    const value = params.id;
    return Array.isArray(value) ? value[0] ?? "" : value ?? "";
  }, [params]);
  const { property, isLoading: isPropertyLoading } = useDataContext();
  const {
    detail,
    isLoading: isDetailLoading,
  } = useRoomTypeDetail(roomTypeIdFromParams);
  const [isDescriptionExpanded, setIsDescriptionExpanded] =
    React.useState(false);
  const [isShareDialogOpen, setIsShareDialogOpen] = React.useState(false);
  const [shareUrl, setShareUrl] = React.useState("");

  // Get current URL for sharing (client-side only)
  React.useEffect(() => {
    if (typeof window !== "undefined") {
      setShareUrl(window.location.href);
    }
  }, []);

  const photosToShow = React.useMemo(() => {
    if (!detail?.roomType || detail.roomType.photos.length === 0) {
      return [
        "/room-placeholder.svg",
        "/room-placeholder.svg",
        "/room-placeholder.svg",
      ];
    }
    const sortedPhotos = [...detail.roomType.photos];
    if (detail.roomType.mainPhotoUrl) {
      const mainIndex = sortedPhotos.indexOf(detail.roomType.mainPhotoUrl);
      if (mainIndex > -1) {
        sortedPhotos.splice(mainIndex, 1);
        sortedPhotos.unshift(detail.roomType.mainPhotoUrl);
      }
    }
    const paddedPhotos = [...sortedPhotos];
    while (paddedPhotos.length < 3) {
      paddedPhotos.push("/room-placeholder.svg");
    }
    return paddedPhotos;
  }, [detail]);

  // Show loading skeleton while data is loading
  if (isPropertyLoading || isDetailLoading) {
    return <RoomDetailsSkeleton />;
  }

  if (!detail?.roomType) {
    notFound();
  }

  const roomType = detail.roomType;
  const relatedRoomTypes = detail.relatedRoomTypes;
  const allAmenities = detail.amenities;
  const standardRatePlan = detail.standardRatePlan ?? undefined;
  const seasonalPrices = detail.seasonalPrices;
  const roomPropertyClosures = detail.propertyClosures;

  const description = roomType.description;
  const truncatedDescription =
    description.length > 200
      ? description.substring(0, 200) + "..."
      : description;



  const newLocal = "container mx-auto p-4 py-6";
  return (
    <div className="min-h-screen">
      {/* Hero Summary Section */}
      <div className={newLocal}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-1 text-sm font-medium">
            <h1 className="text-3xl lg:text-4xl font-bold text-gray-800 mb-4">
              {roomType.name}
            </h1>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setIsShareDialogOpen(true)}
            >
              <Share2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Image Gallery */}
        <div className="mb-8">
          {/* Desktop Grid Gallery */}
          <div className="hidden md:grid md:grid-cols-4 md:grid-rows-2 gap-2 h-[80vh] max-h-[500px] overflow-hidden">
            <div className="md:col-span-2 md:row-span-2 relative">
              <Image
                src={photosToShow[0]}
                alt={`${roomType.name} photo 1`}
                fill
                className="object-cover rounded-lg"
                sizes="(min-width: 768px) 50vw, 100vw"
              />
            </div>
            <div className="md:col-span-2 relative">
              <Image
                src={photosToShow[1]}
                alt={`${roomType.name} photo 2`}
                fill
                className="object-cover rounded-lg"
                sizes="(min-width: 768px) 50vw, 100vw"
              />
            </div>
            <div className="md:col-span-2 relative">
              <Image
                src={photosToShow[2]}
                alt={`${roomType.name} photo 3`}
                fill
                className="object-cover rounded-lg"
                sizes="(min-width: 768px) 50vw, 100vw"
              />
            </div>
          </div>

          {/* Mobile Carousel */}
          <div className="md:hidden">
            <RoomPhotoCarousel photos={photosToShow} roomName={roomType.name} />
          </div>
        </div>

        <div className="grid lg:grid-cols-5 gap-x-12">
          <div className="lg:col-span-3 space-y-8">
            <div>
              <h1 className="text-3xl lg:text-4xl font-bold text-gray-800 mb-4">
                {roomType.name}
              </h1>
              <div className="flex items-center gap-4 text-sm text-muted-foreground mt-2">
                <div className="flex items-center gap-1.5">
                  <MapPin className="h-4 w-4" />
                  <span>Rishikesh, Uttarakhand</span>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-gray-400" />
                  <span className="text-gray-700">
                    Up to {roomType.maxOccupancy} guests
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <Star className="h-5 w-5 text-yellow-400 fill-yellow-400" />
                <span className="font-semibold text-gray-900">4.8</span>
                <span className="text-gray-500">(127 reviews)</span>
              </div>
            </div>

            <p className="text-muted-foreground leading-relaxed">
              {isDescriptionExpanded ? description : truncatedDescription}
              {description.length > 50 && (
                <Button
                  variant="link"
                  className="p-0 h-auto ml-2"
                  onClick={() =>
                    setIsDescriptionExpanded(!isDescriptionExpanded)
                  }
                >
                  {isDescriptionExpanded ? "Read Less" : "Read More"}
                </Button>
              )}
            </p>

            <RoomAmenitiesSection
              roomType={roomType}
              amenities={allAmenities}
            />

            <div className="bg-white rounded-xl p-6 shadow-sm border">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">
                Ashram Rules
              </h2>
              <RoomPoliciesAccordion />
            </div>
          </div>

            <RoomBookingPanel
            roomType={roomType}
            standardRatePlan={standardRatePlan}
            seasonalPrices={seasonalPrices}
            propertyClosures={roomPropertyClosures}
            property={property}
          />
        </div>

        {relatedRoomTypes.length > 0 && (
          <div className="mt-16">
            <h2 className="text-3xl font-bold font-serif text-foreground mb-8">
              Related Rooms
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {relatedRoomTypes.slice(0, 3).map((relatedRoomType) => (
                <RoomTypeCard
                  key={relatedRoomType.id}
                  roomType={relatedRoomType}
                  price={relatedRoomType.price}
                  hasSearched={false}
                  onSelect={() => {}}
                  isSelectionComplete={false}
                  amenities={allAmenities}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {isShareDialogOpen && (
        <ShareDialog
          open={isShareDialogOpen}
          onOpenChange={setIsShareDialogOpen}
          roomType={roomType}
          shareUrl={shareUrl}
        />
      )}
    </div>
  );
}

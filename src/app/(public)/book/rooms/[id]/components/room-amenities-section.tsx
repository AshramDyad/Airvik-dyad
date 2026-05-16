"use client";

import type { Amenity, RoomType } from "@/data/types";
import { Icon } from "@/components/shared/icon";
import type { IconName } from "@/lib/icons";

const amenityIcons: Record<string, IconName> = {
  "Free Wi-Fi": "Wifi",
  "Air Conditioning": "AirVent",
  "Flat-screen TV": "Tv",
  "Mini-bar": "Refrigerator",
  "Ocean View": "Waves",
  "Private Balcony": "GalleryVertical",
  "Ensuite Bathroom": "Bath",
  "Room Service": "ConciergeBell",
  "Lounge chairs": "Armchair",
  "Washing Machine": "WashingMachine",
  Refrigerator: "Refrigerator",
  Bedroom: "Bed",
  Oven: "CookingPot",
  Wifi: "Wifi",
  Bathroom: "Bath",
  "Air Conditioner": "AirVent",
  "Swimming Pool": "Waves",
};

const essentialAmenityNames = new Set([
  "Free Wi-Fi",
  "Wifi",
  "Air Conditioning",
  "Air Conditioner",
  "Ensuite Bathroom",
  "Bathroom",
]);

type RoomAmenitiesSectionProps = {
  roomType: RoomType;
  amenities: Amenity[];
};

export function RoomAmenitiesSection({
  roomType,
  amenities,
}: RoomAmenitiesSectionProps) {
  const renderAmenity = (amenityId: string) => {
    const amenity = amenities.find((item) => item.id === amenityId);
    if (!amenity) return null;

    return (
      <div key={amenity.id} className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Icon
            name={amenityIcons[amenity.name] || amenity.icon}
            className="h-5 w-5 text-primary"
          />
        </div>
        <span className="text-sm font-medium text-gray-700">
          {amenity.name}
        </span>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border">
      <h2 className="text-2xl font-bold text-gray-900 mb-8">Amenities</h2>
      <div className="space-y-6">
        <div>
          <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-4">
            Essentials
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {roomType.amenities
              .filter((amenityId) => {
                const amenity = amenities.find((item) => item.id === amenityId);
                return amenity && essentialAmenityNames.has(amenity.name);
              })
              .map(renderAmenity)}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-4">
            Comfort
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {roomType.amenities
              .filter((amenityId) => {
                const amenity = amenities.find((item) => item.id === amenityId);
                return amenity && !essentialAmenityNames.has(amenity.name);
              })
              .map(renderAmenity)}
          </div>
        </div>
      </div>
    </div>
  );
}

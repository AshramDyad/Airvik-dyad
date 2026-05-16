import type {
  Amenity,
  PropertyClosure,
  RatePlan,
  RoomType,
  SeasonalPrice,
} from "@/data/types";

export type PublicRoomTypeDetail = {
  roomType: RoomType;
  relatedRoomTypes: RoomType[];
  amenities: Amenity[];
  standardRatePlan: RatePlan | null;
  seasonalPrices: SeasonalPrice[];
  propertyClosures: PropertyClosure[];
};

export type PublicRoomTypeDetailResponse = {
  data: PublicRoomTypeDetail | null;
  message?: string;
};

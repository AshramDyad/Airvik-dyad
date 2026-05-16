import type { Amenity, RatePlan, RoomType } from "@/data/types";

export type PublicBookingClosure = {
  roomTypeId?: string;
  startDate: string;
  endDate: string;
};

export type PublicBookingSearchData = {
  roomTypes: RoomType[];
  amenities: Amenity[];
  ratePlan: RatePlan | null;
  propertyClosures: PublicBookingClosure[];
};

export type PublicBookingSearchDataResponse = {
  data: PublicBookingSearchData;
};

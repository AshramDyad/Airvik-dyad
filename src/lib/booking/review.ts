import type {
  PropertyClosure,
  RatePlan,
  RoomType,
  SeasonalPrice,
} from "@/data/types";

export type PublicBookingReviewData = {
  roomTypes: RoomType[];
  ratePlan: RatePlan | null;
  seasonalPrices: SeasonalPrice[];
  propertyClosures: PropertyClosure[];
};

export type PublicBookingReviewDataResponse = {
  data: PublicBookingReviewData | null;
  message?: string;
};

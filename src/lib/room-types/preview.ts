export type RoomTypePreviewAmenity = {
  id: string;
  name: string;
  icon: string;
};

export type RoomTypePreview = {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  amenities: RoomTypePreviewAmenity[];
};

export type RoomTypePreviewResponse = {
  data: RoomTypePreview[];
};

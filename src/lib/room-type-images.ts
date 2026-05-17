import type { RoomType } from "@/data/types";

const PLACEHOLDER_IMAGE = "/room-placeholder.svg";

const normalizeRoomName = (value: string) =>
  value
    .split("[")[0]
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

const ROOM_IMAGE_FALLBACKS: Record<string, string> = {
  annadaan: "/annakshetra.png",
  "sant bhojan donation": "/Dining Hall.png",
  brahmbhoj: "/Dining Hall.png",
  vidhyadan: "/gallery-room-05-2-1.png",
  "havan donation": "/Standard-Room.png",
  "ganga aarti": "/gallery-room-05-2-1.png",
  "krishna kutir": "/Standard-Room.png",
  "gowseva donation": "/annakshetra.png",
};

type RoomTypeImageSource = Pick<RoomType, "name"> &
  Partial<Pick<RoomType, "mainPhotoUrl" | "photos">>;

const getPatternFallback = (normalizedName: string) => {
  if (
    normalizedName.includes("bhoj") ||
    normalizedName.includes("dining") ||
    normalizedName.includes("sant")
  ) {
    return "/Dining Hall.png";
  }

  if (
    normalizedName.includes("ganga") ||
    normalizedName.includes("vidhya") ||
    normalizedName.includes("vidya")
  ) {
    return "/gallery-room-05-2-1.png";
  }

  if (
    normalizedName.includes("room") ||
    normalizedName.includes("kutir") ||
    normalizedName.includes("deluxe") ||
    normalizedName.includes("premium") ||
    normalizedName.includes("economy")
  ) {
    return "/Standard-Room.png";
  }

  if (
    normalizedName.includes("anna") ||
    normalizedName.includes("gauseva") ||
    normalizedName.includes("gowseva") ||
    normalizedName.includes("gau")
  ) {
    return "/annakshetra.png";
  }

  return PLACEHOLDER_IMAGE;
};

export const getRoomTypeImageUrl = (
  roomType?: RoomTypeImageSource | null
) => {
  if (!roomType) {
    return PLACEHOLDER_IMAGE;
  }

  const mainPhotoUrl = roomType.mainPhotoUrl?.trim();
  if (mainPhotoUrl) {
    return mainPhotoUrl;
  }

  const firstPhoto = roomType.photos?.find((photo) => photo.trim().length > 0);
  if (firstPhoto) {
    return firstPhoto;
  }

  const normalizedName = normalizeRoomName(roomType.name);
  return ROOM_IMAGE_FALLBACKS[normalizedName] ?? getPatternFallback(normalizedName);
};

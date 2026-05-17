import { describe, expect, it } from "vitest";

import { getRoomTypeImageUrl } from "./room-type-images";

describe("getRoomTypeImageUrl", () => {
  it("prefers configured main and gallery photos", () => {
    expect(
      getRoomTypeImageUrl({
        name: "AnnaDaan",
        mainPhotoUrl: "https://example.com/main.jpg",
        photos: ["/fallback.png"],
      })
    ).toBe("https://example.com/main.jpg");

    expect(
      getRoomTypeImageUrl({
        name: "AnnaDaan",
        photos: ["", "/gallery.png"],
      })
    ).toBe("/gallery.png");
  });

  it("uses known public fallbacks for current room names", () => {
    expect(getRoomTypeImageUrl({ name: "AnnaDaan" })).toBe("/annakshetra.png");
    expect(getRoomTypeImageUrl({ name: "Sant Bhojan Donation" })).toBe(
      "/Dining Hall.png"
    );
    expect(getRoomTypeImageUrl({ name: "Brahmbhoj" })).toBe("/Dining Hall.png");
    expect(getRoomTypeImageUrl({ name: "VidhyaDan" })).toBe(
      "/gallery-room-05-2-1.png"
    );
    expect(getRoomTypeImageUrl({ name: "Havan Donation" })).toBe(
      "/Standard-Room.png"
    );
  });

  it("falls back by room name pattern before using placeholder", () => {
    expect(getRoomTypeImageUrl({ name: "Family Premium" })).toBe(
      "/Standard-Room.png"
    );
    expect(getRoomTypeImageUrl({ name: "Unknown offering" })).toBe(
      "/room-placeholder.svg"
    );
  });
});


import { describe, expect, it } from "vitest";

import type { EventBanner } from "@/data/types";
import { isEventBannerActive, mapEventBannerRow } from "./event-banners";

const baseBanner: EventBanner = {
  id: "11111111-1111-4111-8111-111111111111",
  title: "Meditation Retreat",
  imageUrl: "https://example.com/banner.jpg",
  isActive: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("event banner helpers", () => {
  it("maps database rows without leaking snake_case fields", () => {
    expect(
      mapEventBannerRow({
        id: baseBanner.id,
        title: baseBanner.title,
        description: null,
        image_url: baseBanner.imageUrl,
        is_active: true,
        starts_at: null,
        ends_at: null,
        updated_by: null,
        created_at: baseBanner.createdAt,
        updated_at: baseBanner.updatedAt,
      })
    ).toEqual(baseBanner);
  });

  it("requires the active flag", () => {
    expect(isEventBannerActive({ ...baseBanner, isActive: false })).toBe(false);
  });

  it("accepts banners inside a bounded active window", () => {
    expect(
      isEventBannerActive(
        {
          ...baseBanner,
          startsAt: "2026-05-12T00:00:00.000Z",
          endsAt: "2026-05-14T00:00:00.000Z",
        },
        new Date("2026-05-13T00:00:00.000Z")
      )
    ).toBe(true);
  });

  it("rejects a future start date even when there is no end date", () => {
    expect(
      isEventBannerActive(
        {
          ...baseBanner,
          startsAt: "2026-05-14T00:00:00.000Z",
          endsAt: undefined,
        },
        new Date("2026-05-13T00:00:00.000Z")
      )
    ).toBe(false);
  });

  it("rejects an expired end date even when there is no start date", () => {
    expect(
      isEventBannerActive(
        {
          ...baseBanner,
          startsAt: undefined,
          endsAt: "2026-05-12T00:00:00.000Z",
        },
        new Date("2026-05-13T00:00:00.000Z")
      )
    ).toBe(false);
  });
});

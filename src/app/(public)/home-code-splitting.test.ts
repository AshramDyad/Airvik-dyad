import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const pagePath = join(process.cwd(), "src/app/(public)/page.tsx");
const routeDir = join(process.cwd(), "src/app/(public)");

describe("public home code splitting", () => {
  it("keeps the home route as a server shell with deferred client sections", () => {
    const pageSource = readFileSync(pagePath, "utf8");
    const loaderSource = readFileSync(
      join(routeDir, "home-deferred-sections-loader.tsx"),
      "utf8",
    );
    const deferredSource = readFileSync(
      join(routeDir, "home-deferred-sections.tsx"),
      "utf8",
    );
    const featureCardSource = readFileSync(
      join(process.cwd(), "src/components/marketing/home/FeatureCard.tsx"),
      "utf8",
    );

    expect(pageSource).toContain("HomeDeferredSectionsLoader");
    expect(pageSource).not.toContain('"use client"');
    expect(pageSource).not.toContain("framer-motion");
    expect(pageSource).not.toContain("dynamic(");
    expect(pageSource).not.toContain(
      'import { WelcomeSection } from "@/components/marketing/home/WelcomeSection"',
    );
    expect(pageSource).not.toContain(
      'import { GallerySection } from "@/components/marketing/home/GallerySection"',
    );
    expect(pageSource).not.toContain(
      'import { VideoSection } from "@/components/marketing/home/VideoSection"',
    );
    expect(pageSource).not.toContain(
      'import { RoomsShowcaseSection } from "@/components/marketing/home/RoomsShowcaseSection"',
    );
    expect(pageSource).not.toContain(
      'import { ReviewSection } from "@/components/marketing/home/ReviewSection"',
    );
    expect(pageSource).not.toContain(
      'import { SupportActionsSection } from "@/components/marketing/home/SupportActionsSection"',
    );
    expect(pageSource).not.toContain("MessageSquareHeart");
    expect(loaderSource).toContain("const DynamicHomeDeferredSections = dynamic");
    expect(loaderSource).toContain("./home-deferred-sections");
    expect(deferredSource).toContain("EventBannerModal");
    expect(deferredSource).toContain("WelcomeSection");
    expect(deferredSource).toContain("SupportActionsSection");
    expect(featureCardSource).not.toContain('"use client"');
    expect(featureCardSource).not.toContain("next/link");
  });

  it("sizes home and deferred marketing images for responsive variants", () => {
    const pageSource = readFileSync(pagePath, "utf8");
    const featureCardSource = readFileSync(
      join(process.cwd(), "src/components/marketing/home/FeatureCard.tsx"),
      "utf8",
    );
    const activityCardSource = readFileSync(
      join(process.cwd(), "src/components/marketing/home/ActivityCard.tsx"),
      "utf8",
    );
    const gallerySource = readFileSync(
      join(process.cwd(), "src/components/marketing/home/GallerySection.tsx"),
      "utf8",
    );
    const roomsShowcaseSource = readFileSync(
      join(process.cwd(), "src/components/marketing/home/RoomsShowcaseSection.tsx"),
      "utf8",
    );
    const reviewSource = readFileSync(
      join(process.cwd(), "src/components/marketing/home/ReviewSection.tsx"),
      "utf8",
    );
    const accommodationSource = readFileSync(
      join(process.cwd(), "src/components/marketing/home/AccommodationCard.tsx"),
      "utf8",
    );

    expect(pageSource).toContain('sizes="100vw"');
    expect(featureCardSource).toContain('sizes="(max-width: 1024px) 100vw, 33vw"');
    expect(activityCardSource).toContain('sizes="(max-width: 768px) 100vw, 33vw"');
    expect(gallerySource).toContain('sizes="(max-width: 768px) 100vw, 33vw"');
    expect(roomsShowcaseSource).toContain('sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"');
    expect(reviewSource).toContain('sizes="(min-width: 1024px) 128px, 96px"');
    expect(accommodationSource).toContain('sizes="(max-width: 768px) 100vw, 33vw"');
  });

  it("uses a compact room preview API instead of global room type data", () => {
    const roomsShowcaseSource = readFileSync(
      join(process.cwd(), "src/components/marketing/home/RoomsShowcaseSection.tsx"),
      "utf8",
    );

    expect(roomsShowcaseSource).toContain("useRoomTypePreview");
    expect(roomsShowcaseSource).not.toContain("useDataContext");
    expect(roomsShowcaseSource).not.toContain("roomTypes, amenities");
  });
});

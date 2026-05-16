import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const pagePath = join(
  process.cwd(),
  "src/app/(public)/book/rooms/[id]/page.tsx",
);
const clientPath = join(
  process.cwd(),
  "src/app/(public)/book/rooms/[id]/room-detail-client.tsx",
);
const loaderPath = join(
  process.cwd(),
  "src/app/(public)/book/rooms/[id]/room-detail-client-loader.tsx",
);
const skeletonPath = join(
  process.cwd(),
  "src/components/public/room-details-skeleton.tsx",
);
const photoCarouselPath = join(
  process.cwd(),
  "src/app/(public)/book/rooms/[id]/components/room-photo-carousel.tsx",
);

describe("room detail code splitting", () => {
  it("keeps the route page as a server shell around the client room detail workflow", () => {
    const pageSource = readFileSync(pagePath, "utf8");
    const loaderSource = readFileSync(loaderPath, "utf8");

    expect(pageSource).toContain("RoomDetailClientLoader");
    expect(pageSource).not.toContain('"use client"');
    expect(pageSource).not.toContain("useParams");
    expect(pageSource).not.toContain("@/context/data-context");
    expect(pageSource).not.toContain("lucide-react");
    expect(loaderSource).toContain("const DynamicRoomDetailClient = dynamic");
    expect(loaderSource).toContain("./room-detail-client");
  });

  it("uses a compact room detail API instead of global public booking data", () => {
    const pageSource = readFileSync(clientPath, "utf8");
    const cardSource = readFileSync(
      join(process.cwd(), "src/components/public/room-type-card.tsx"),
      "utf8",
    );

    expect(pageSource).toContain("useRoomTypeDetail");
    expect(pageSource).not.toContain("roomTypes,");
    expect(pageSource).not.toContain("ratePlans,");
    expect(pageSource).not.toContain("seasonalPrices,");
    expect(pageSource).not.toContain("propertyClosures,");
    expect(pageSource).not.toContain("amenities: allAmenities");
    expect(cardSource).toContain("amenities?: Amenity[]");
    expect(cardSource).not.toContain("useDataContext");
  });

  it("keeps deferred room detail UI behind dynamic imports", () => {
    const pageSource = readFileSync(clientPath, "utf8");

    expect(pageSource).toContain("dynamic(");
    expect(pageSource).not.toContain(
      'import { ShareDialog } from "@/components/public/share-dialog"',
    );
    expect(pageSource).not.toContain(
      'import { RoomTypeCard } from "@/components/public/room-type-card"',
    );
    expect(pageSource).not.toContain(
      'import { Calendar } from "@/components/ui/calendar"',
    );
    expect(pageSource).not.toContain("@/components/ui/carousel");
    expect(pageSource).not.toContain("@/components/ui/accordion");
    expect(pageSource).toContain("isShareDialogOpen &&");
  });

  it("keeps the booking form stack out of the initial room detail page chunk", () => {
    const pageSource = readFileSync(clientPath, "utf8");

    expect(pageSource).toContain("./components/room-booking-panel");
    expect(pageSource).not.toContain('from "react-hook-form"');
    expect(pageSource).not.toContain('from "@hookform/resolvers/zod"');
    expect(pageSource).not.toContain('from "zod"');
    expect(pageSource).not.toContain("@/components/ui/form");
    expect(pageSource).not.toContain("@/components/ui/popover");
    expect(pageSource).not.toContain("@/components/ui/pricing-breakdown");
    expect(pageSource).not.toContain("@/hooks/use-room-type-availability-search");
    expect(pageSource).not.toContain("@/hooks/use-room-type-inventory");
    expect(pageSource).not.toContain("@/lib/pricing-calculator");
  });

  it("defers the dynamic amenity icon map from the initial room detail page chunk", () => {
    const pageSource = readFileSync(clientPath, "utf8");

    expect(pageSource).toContain("./components/room-amenities-section");
    expect(pageSource).not.toContain("@/components/shared/icon");
    expect(pageSource).not.toContain("@/lib/icons");
  });

  it("keeps the room detail loader skeleton free of shared card utilities", () => {
    const skeletonSource = readFileSync(skeletonPath, "utf8");

    expect(skeletonSource).not.toContain("@/components/ui/card");
    expect(skeletonSource).not.toContain("<Card");
    expect(skeletonSource).toContain("RoomDetailsSkeleton");
  });

  it("uses the transformed image pipeline for room gallery photos", () => {
    const pageSource = readFileSync(clientPath, "utf8");
    const carouselSource = readFileSync(photoCarouselPath, "utf8");

    expect(pageSource).toContain('import Image from "next/image"');
    expect(pageSource).not.toContain("<img");
    expect(pageSource).toContain('sizes="(min-width: 768px) 50vw, 100vw"');
    expect(carouselSource).toContain('import Image from "next/image"');
    expect(carouselSource).not.toContain("<img");
    expect(carouselSource).toContain('sizes="100vw"');
  });
});

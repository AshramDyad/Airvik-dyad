import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const routeDir = join(process.cwd(), "src/app/(public)/ashram-glimpse");
const galleryDir = join(process.cwd(), "src/components/marketing/gallery");

describe("ashram glimpse code splitting", () => {
  it("loads the gallery page section through a dynamic route loader", () => {
    const pageSource = readFileSync(join(routeDir, "page.tsx"), "utf8");
    const loaderSource = readFileSync(
      join(routeDir, "gallery-page-section-loader.tsx"),
      "utf8",
    );

    expect(pageSource).toContain("GalleryPageSectionLoader");
    expect(pageSource).not.toContain('"use client"');
    expect(pageSource).not.toContain(
      "@/components/marketing/gallery/gallery-page-section",
    );
    expect(loaderSource).toContain("const DynamicGalleryPageSection = dynamic");
    expect(loaderSource).toContain(
      "@/components/marketing/gallery/gallery-page-section",
    );
  });

  it("keeps the lightbox package out of the initial gallery section chunk", () => {
    const sectionSource = readFileSync(
      join(galleryDir, "gallery-page-section.tsx"),
      "utf8",
    );
    const lightboxSource = readFileSync(join(galleryDir, "gallery-lightbox.tsx"), "utf8");

    expect(sectionSource).toContain("const DynamicGalleryLightbox = dynamic");
    expect(sectionSource).toContain("./gallery-lightbox");
    expect(sectionSource).not.toContain("yet-another-react-lightbox");
    expect(sectionSource).not.toContain("plugins/download");
    expect(sectionSource).not.toContain("plugins/counter");
    expect(lightboxSource).toContain("yet-another-react-lightbox");
    expect(lightboxSource).toContain("plugins/download");
    expect(lightboxSource).toContain("plugins/counter");
  });
});

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const routeDir = join(process.cwd(), "src/app/(public)/amenities");
const heroPath = join(
  process.cwd(),
  "src/components/marketing/amenities/HeroSection.tsx",
);

describe("amenities page code splitting", () => {
  it("keeps the static hero server-rendered and defers lower sections", () => {
    const pageSource = readFileSync(join(routeDir, "page.tsx"), "utf8");
    const loaderSource = readFileSync(
      join(routeDir, "amenities-sections-loader.tsx"),
      "utf8",
    );
    const sectionsSource = readFileSync(
      join(routeDir, "amenities-sections.tsx"),
      "utf8",
    );
    const heroSource = readFileSync(heroPath, "utf8");

    expect(pageSource).toContain("AmenitiesHeroSection");
    expect(pageSource).toContain("AmenitiesSectionsLoader");
    expect(pageSource).not.toContain("EssentialAmenitiesGrid");
    expect(pageSource).not.toContain("DailyRhythmSection");
    expect(heroSource).not.toContain('"use client"');
    expect(loaderSource).toContain("const DynamicAmenitiesSections = dynamic");
    expect(loaderSource).toContain("./amenities-sections");
    expect(sectionsSource).toContain("EssentialAmenitiesGrid");
    expect(sectionsSource).toContain("DailyRhythmSection");
  });

  it("sizes the hero background for viewport-width image variants", () => {
    const heroSource = readFileSync(heroPath, "utf8");

    expect(heroSource).toContain('sizes="100vw"');
  });
});

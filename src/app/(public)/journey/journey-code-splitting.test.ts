import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const routeDir = join(process.cwd(), "src/app/(public)/journey");
const heroPath = join(
  process.cwd(),
  "src/components/marketing/journey/JourneyHeroSection.tsx",
);
const timelinePath = join(
  process.cwd(),
  "src/components/marketing/journey/JourneyTimeline.tsx",
);

describe("journey page code splitting", () => {
  it("keeps the hero in the page shell and defers lower journey sections", () => {
    const pageSource = readFileSync(join(routeDir, "page.tsx"), "utf8");
    const heroSource = readFileSync(heroPath, "utf8");
    const loaderSource = readFileSync(
      join(routeDir, "journey-sections-loader.tsx"),
      "utf8",
    );
    const sectionsSource = readFileSync(join(routeDir, "journey-sections.tsx"), "utf8");

    expect(pageSource).toContain("JourneyHeroSection");
    expect(pageSource).toContain("JourneySectionsLoader");
    expect(pageSource).not.toContain('"use client"');
    expect(pageSource).not.toContain("JourneyTimeline");
    expect(pageSource).not.toContain("JourneyCTA");
    expect(loaderSource).toContain("const DynamicJourneySections = dynamic");
    expect(loaderSource).toContain("./journey-sections");
    expect(sectionsSource).toContain("JourneyTimeline");
    expect(sectionsSource).toContain("JourneyCTA");
    expect(heroSource).not.toContain('"use client"');
    expect(heroSource).not.toContain("framer-motion");
  });

  it("sizes hero and timeline images for responsive variants", () => {
    const heroSource = readFileSync(heroPath, "utf8");
    const timelineSource = readFileSync(timelinePath, "utf8");

    expect(heroSource).toContain('sizes="100vw"');
    expect(timelineSource).toContain(
      'sizes="(max-width: 768px) 100vw, 45vw"',
    );
  });
});

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const routeDir = join(process.cwd(), "src/app/(public)/about-us");

describe("about us page code splitting", () => {
  it("keeps the hero in the page shell and defers lower about sections", () => {
    const pageSource = readFileSync(join(routeDir, "page.tsx"), "utf8");
    const heroSource = readFileSync(
      join(process.cwd(), "src/components/marketing/about/about-hero-section.tsx"),
      "utf8",
    );
    const loaderSource = readFileSync(
      join(routeDir, "about-us-sections-loader.tsx"),
      "utf8",
    );
    const sectionsSource = readFileSync(
      join(routeDir, "about-us-sections.tsx"),
      "utf8",
    );

    expect(pageSource).toContain("AboutHeroSection");
    expect(pageSource).toContain("AboutUsSectionsLoader");
    expect(pageSource).not.toContain('"use client"');
    expect(pageSource).not.toContain("AboutStorySection");
    expect(pageSource).not.toContain("AboutActivitiesSection");
    expect(pageSource).not.toContain("PlacesToVisitSection");
    expect(loaderSource).toContain("const DynamicAboutUsSections = dynamic");
    expect(loaderSource).toContain("./about-us-sections");
    expect(sectionsSource).toContain("AboutStorySection");
    expect(sectionsSource).toContain("AboutActivitiesSection");
    expect(sectionsSource).toContain("PlacesToVisitSection");
    expect(heroSource).not.toContain('"use client"');
    expect(heroSource).not.toContain("framer-motion");
    expect(heroSource).not.toContain("next/link");
    expect(heroSource).toContain('href="#our-story"');
  });
});

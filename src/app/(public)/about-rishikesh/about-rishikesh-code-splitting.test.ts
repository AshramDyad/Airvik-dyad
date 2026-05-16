import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const routeDir = join(process.cwd(), "src/app/(public)/about-rishikesh");
const experiencePath = join(
  process.cwd(),
  "src/components/marketing/about/rishikesh-experience-section.tsx",
);

describe("about Rishikesh code splitting", () => {
  it("keeps the hero in the page shell and defers lower page sections", () => {
    const pageSource = readFileSync(join(routeDir, "page.tsx"), "utf8");
    const heroSource = readFileSync(
      join(
        process.cwd(),
        "src/components/marketing/about/rishikesh-hero-section.tsx",
      ),
      "utf8",
    );
    const loaderSource = readFileSync(
      join(routeDir, "rishikesh-sections-loader.tsx"),
      "utf8",
    );
    const sectionsSource = readFileSync(
      join(routeDir, "rishikesh-sections.tsx"),
      "utf8",
    );

    expect(pageSource).toContain("RishikeshHeroSection");
    expect(pageSource).toContain("RishikeshSectionsLoader");
    expect(pageSource).not.toContain('"use client"');
    expect(pageSource).not.toContain("KeyAttractionsSection");
    expect(pageSource).not.toContain("MapSection");
    expect(loaderSource).toContain("const DynamicRishikeshSections = dynamic");
    expect(loaderSource).toContain("./rishikesh-sections");
    expect(sectionsSource).toContain("KeyAttractionsSection");
    expect(sectionsSource).toContain("MapSection");
    expect(heroSource).not.toContain('"use client"');
    expect(heroSource).not.toContain("framer-motion");
    expect(heroSource).not.toContain("next/link");
    expect(heroSource).toContain('href="#rishikesh-experience"');
  });

  it("sizes the deferred experience background for viewport-width image variants", () => {
    const experienceSource = readFileSync(experiencePath, "utf8");

    expect(experienceSource).toContain('sizes="100vw"');
  });
});

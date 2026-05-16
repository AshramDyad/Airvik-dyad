import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const routeDir = join(process.cwd(), "src/app/(public)/sunil-bhagat");

describe("sunil bhagat page code splitting", () => {
  it("keeps a static intro in the shell and defers profile and speech sections", () => {
    const pageSource = readFileSync(join(routeDir, "page.tsx"), "utf8");
    const profileLoaderSource = readFileSync(
      join(routeDir, "sunil-bhagat-profile-loader.tsx"),
      "utf8",
    );
    const profileSource = readFileSync(
      join(routeDir, "sunil-bhagat-profile.tsx"),
      "utf8",
    );
    const loaderSource = readFileSync(
      join(routeDir, "sunil-bhagat-sections-loader.tsx"),
      "utf8",
    );
    const sectionsSource = readFileSync(
      join(routeDir, "sunil-bhagat-sections.tsx"),
      "utf8",
    );

    expect(pageSource).toContain("SunilBhagatIntro");
    expect(pageSource).toContain("SunilBhagatProfileLoader");
    expect(pageSource).toContain("SunilBhagatSectionsLoader");
    expect(pageSource).not.toContain('"use client"');
    expect(pageSource).not.toContain("SunilBhagatUnifiedSection");
    expect(pageSource).not.toContain("SwamiSpeechSection");
    expect(profileLoaderSource).toContain(
      "const DynamicSunilBhagatProfile = dynamic",
    );
    expect(profileLoaderSource).toContain("./sunil-bhagat-profile");
    expect(profileSource).toContain("SunilBhagatUnifiedSection");
    expect(profileSource).toContain("showIntro={false}");
    expect(loaderSource).toContain("const DynamicSunilBhagatSections = dynamic");
    expect(loaderSource).toContain("./sunil-bhagat-sections");
    expect(sectionsSource).toContain("SwamiSpeechSection");
  });
});

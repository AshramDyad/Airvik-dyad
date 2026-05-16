import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const componentsDir = join(process.cwd(), "src/components/public");

describe("brochure download card code splitting", () => {
  it("keeps the brochure card server-rendered and defers clipboard behavior", () => {
    const cardSource = readFileSync(
      join(componentsDir, "brochure-download-card.tsx"),
      "utf8",
    );
    const loaderSource = readFileSync(
      join(componentsDir, "brochure-copy-link-button-loader.tsx"),
      "utf8",
    );
    const buttonSource = readFileSync(
      join(componentsDir, "brochure-copy-link-button.tsx"),
      "utf8",
    );

    expect(cardSource).not.toContain('"use client"');
    expect(cardSource).not.toContain("useState");
    expect(cardSource).not.toContain("navigator.clipboard");
    expect(cardSource).not.toContain("sonner");
    expect(cardSource).toContain("BrochureCopyLinkButtonLoader");
    expect(cardSource).toContain('target="_blank"');
    expect(loaderSource).toContain("const DynamicBrochureCopyLinkButton = dynamic");
    expect(loaderSource).toContain("./brochure-copy-link-button");
    expect(loaderSource).not.toContain("@/components/ui/button");
    expect(loaderSource).not.toContain("lucide-react");
    expect(buttonSource).toContain('"use client"');
    expect(buttonSource).toContain("navigator.clipboard");
    expect(buttonSource).toContain("toast.");
  });
});

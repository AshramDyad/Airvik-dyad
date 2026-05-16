import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const routeDir = join(process.cwd(), "src/app/(public)/donate/success");

describe("donation success page code splitting", () => {
  it("keeps the success route server-rendered and defers receipt storage lookup", () => {
    const pageSource = readFileSync(join(routeDir, "page.tsx"), "utf8");
    const loaderSource = readFileSync(
      join(routeDir, "donation-success-card-loader.tsx"),
      "utf8",
    );
    const cardSource = readFileSync(
      join(process.cwd(), "src/components/donations/donation-success-card.tsx"),
      "utf8",
    );

    expect(pageSource).not.toContain('"use client"');
    expect(pageSource).toContain("DonationSuccessCardLoader");
    expect(pageSource).not.toContain('from "@/components/donations/donation-success-card"');
    expect(pageSource).not.toContain("next/link");
    expect(loaderSource).toContain("const DynamicDonationSuccessCard = dynamic");
    expect(loaderSource).toContain("@/components/donations/donation-success-card");
    expect(cardSource).toContain('"use client"');
    expect(cardSource).toContain("getDonationReceipt");
    expect(cardSource).not.toContain("next/link");
  });
});

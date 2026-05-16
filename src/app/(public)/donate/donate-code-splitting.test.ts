import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const routeDir = join(process.cwd(), "src/app/(public)/donate");
const donationsDir = join(process.cwd(), "src/components/donations");

describe("donate page code splitting", () => {
  it("keeps payment form and FAQ client workflows behind dynamic loaders", () => {
    const pageSource = readFileSync(join(routeDir, "page.tsx"), "utf8");
    const formLoaderSource = readFileSync(
      join(donationsDir, "donation-form-loader.tsx"),
      "utf8",
    );
    const faqLoaderSource = readFileSync(
      join(donationsDir, "faq-accordion-loader.tsx"),
      "utf8",
    );

    expect(pageSource).toContain("DonationHero");
    expect(pageSource).toContain("ImpactStatsGrid");
    expect(pageSource).toContain("DonationFormLoader");
    expect(pageSource).toContain("DonationFaqAccordionLoader");
    expect(pageSource).not.toContain("DonationForm }");
    expect(pageSource).not.toContain("DonationFaqAccordion }");
    expect(formLoaderSource).toContain("const DynamicDonationForm = dynamic");
    expect(formLoaderSource).toContain("./donation-form");
    expect(formLoaderSource).toContain('id="donation-form"');
    expect(faqLoaderSource).toContain("const DynamicDonationFaqAccordion = dynamic");
    expect(faqLoaderSource).toContain("./faq-accordion");
  });

  it("keeps the cancel page free of the Next Link client runtime", () => {
    const pageSource = readFileSync(join(routeDir, "cancel/page.tsx"), "utf8");

    expect(pageSource).not.toContain("next/link");
    expect(pageSource).not.toContain("<Link");
    expect(pageSource).toContain('href="/donate"');
    expect(pageSource).toContain('href="/"');
  });

  it("posts donation payment commands without caching responses", () => {
    const formSource = readFileSync(
      join(donationsDir, "donation-form.tsx"),
      "utf8",
    );

    expect(formSource).toContain('fetch("/api/donations/create-order", {');
    expect(formSource).toContain('fetch("/api/donations/verify-payment", {');
    expect(formSource.match(/cache: "no-store"/g) ?? []).toHaveLength(2);
  });
});

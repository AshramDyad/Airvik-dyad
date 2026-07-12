import { DonationHero } from "@/components/donations/donation-hero";
import { ImpactStatsGrid } from "@/components/donations/impact-stats-grid";
import { DonationForm } from "@/components/donations/donation-form";
import { TrustSignals } from "@/components/donations/trust-signals";
import { DonationFaqAccordion } from "@/components/donations/faq-accordion";
import type { Metadata } from "next";
import { getDonationStats } from "@/lib/api/donations";
import { getPropertyCurrency } from "@/lib/server/property";
import { buildMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = buildMetadata({
  title: "Donate & Support Seva",
  description:
    "Support Sahajanand Wellness with a contribution and keep daily seva alive in Rishikesh — langar (annakshetra), gaushala, Vedic classes and Ganga Aarti on the banks of the Ganges.",
  path: "/donate",
});

export default async function DonatePage() {
  const [stats, currency] = await Promise.all([getDonationStats(), getPropertyCurrency()]);

  return (
    <div className="space-y-0">
      <DonationHero />
      <ImpactStatsGrid stats={stats} currency={currency} />
      <DonationForm currency={currency} />
      <TrustSignals />
      <DonationFaqAccordion />
    </div>
  );
}

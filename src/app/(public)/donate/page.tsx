import { DonationHero } from "@/components/donations/donation-hero";
import { ImpactStatsGrid } from "@/components/donations/impact-stats-grid";
import { DonationFormLoader } from "@/components/donations/donation-form-loader";
import { TrustSignals } from "@/components/donations/trust-signals";
import { DonationFaqAccordionLoader } from "@/components/donations/faq-accordion-loader";
import { getDonationStats } from "@/lib/api/donations";
import { getPropertyCurrency } from "@/lib/server/property";

export const metadata = {
  title: "Donate | Sahajanand Wellness",
  description: "Support Sahajanand Wellness with a tax-deductible contribution and keep seva alive in Rishikesh.",
};

export const revalidate = 300;

export default async function DonatePage() {
  const [stats, currency] = await Promise.all([getDonationStats(), getPropertyCurrency()]);

  return (
    <div className="space-y-0">
      <DonationHero />
      <ImpactStatsGrid stats={stats} currency={currency} />
      <DonationFormLoader currency={currency} />
      <TrustSignals />
      <DonationFaqAccordionLoader />
    </div>
  );
}

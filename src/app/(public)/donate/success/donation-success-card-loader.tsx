"use client";

import dynamic from "next/dynamic";

interface DonationSuccessCardLoaderProps {
  donationId: string;
  fallbackCurrency: string;
}

const DynamicDonationSuccessCard = dynamic(
  () =>
    import("@/components/donations/donation-success-card").then(
      (module) => module.DonationSuccessCard,
    ),
  {
    loading: () => (
      <div className="rounded-3xl border border-border bg-white/80 p-8 shadow">
        <p className="text-center text-sm text-muted-foreground">
          Preparing your receipt...
        </p>
      </div>
    ),
  },
);

export function DonationSuccessCardLoader({
  donationId,
  fallbackCurrency,
}: DonationSuccessCardLoaderProps) {
  return (
    <DynamicDonationSuccessCard
      donationId={donationId}
      fallbackCurrency={fallbackCurrency}
    />
  );
}

import { getPropertyCurrency } from "@/lib/server/property";
import { DonationSuccessCardLoader } from "./donation-success-card-loader";

export const metadata = {
  title: "Donation Successful | Sahajanand Wellness",
};

export default async function DonateSuccessPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedParams = searchParams ? await searchParams : {};
  const donationIdParam = resolvedParams.donation_id;
  const donationId = Array.isArray(donationIdParam) ? donationIdParam[0] : donationIdParam;
  const currency = await getPropertyCurrency();

  return (
    <div className="bg-muted/20 py-16">
      <div className="mx-auto max-w-3xl px-6">
        {donationId ? (
          <DonationSuccessCardLoader
            donationId={donationId}
            fallbackCurrency={currency}
          />
        ) : (
          <div className="rounded-3xl border border-destructive/30 bg-destructive/10 p-10 text-center">
            <p className="text-lg font-semibold text-destructive">Missing donation reference.</p>
            <p className="mt-2 text-sm text-destructive/80">Please return to the donations page and try again.</p>
            <a href="/donate" className="mt-4 inline-flex text-sm font-semibold text-primary underline">
              Back to donations
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

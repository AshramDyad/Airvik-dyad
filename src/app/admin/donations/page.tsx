import type { DonationListFilters } from "@/lib/api/donations";
import { getPropertyCurrency } from "@/lib/server/property";
import { DonationStatsGrid } from "@/components/admin/donations/donation-stats";
import type { DonationFrequency, DonationStatus } from "@/data/types";
import { requirePageFeature } from "@/lib/server/page-auth";
import { getAdminDonationStats, getAdminDonations } from "@/lib/server/donations";
import { DonationsIndexLoader } from "./donations-index-loader";

export const metadata = {
  title: "Donations | Admin",
};

type SearchParamRecord = Record<string, string | string[] | undefined>;

function getParamValue(params: SearchParamRecord, key: string): string | undefined {
  const value = params[key];
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

function toIsoDate(value?: string): string | undefined {
  if (!value) return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }
  return parsed.toISOString();
}

export default async function AdminDonationsPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParamRecord>;
}) {
  await requirePageFeature("donations");
  const resolvedParams = (await searchParams) ?? {};
  const query = getParamValue(resolvedParams, "query");
  const status = getParamValue(resolvedParams, "status");
  const frequency = getParamValue(resolvedParams, "frequency");
  const from = getParamValue(resolvedParams, "from");
  const to = getParamValue(resolvedParams, "to");

  const filters: DonationListFilters = {
    query: query || undefined,
    status:
      status && status !== "all" ? (status as DonationStatus) : undefined,
    frequency:
      frequency && frequency !== "all" ? (frequency as DonationFrequency) : undefined,
    from: toIsoDate(from),
    to: toIsoDate(to),
  };

  const [stats, donations, currency] = await Promise.all([
    getAdminDonationStats(),
    getAdminDonations(filters),
    getPropertyCurrency(),
  ]);

  const initialFilters = {
    query: query ?? "",
    status: status ?? "all",
    frequency: frequency ?? "all",
    from: from ?? "",
    to: to ?? "",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Donations</h1>
        <p className="text-sm text-muted-foreground">
          Monitor incoming support, manage offline gifts, and keep your finance trail audit-ready.
        </p>
      </div>

      <DonationStatsGrid stats={stats} currency={currency} />

      <DonationsIndexLoader initialFilters={initialFilters} donations={donations} />
    </div>
  );
}

"use client";

import type { Donation } from "@/data/types";
import { DonationFilters } from "@/components/admin/donations/donation-filters";
import { DonationsTable } from "@/components/admin/donations/donations-table";

export type DonationsIndexPanelProps = {
  initialFilters: {
    query: string;
    status: string;
    frequency: string;
    from: string;
    to: string;
  };
  donations: Donation[];
};

export function DonationsIndexPanel({
  initialFilters,
  donations,
}: DonationsIndexPanelProps) {
  return (
    <>
      <DonationFilters initialValues={initialFilters} />
      <DonationsTable donations={donations} />
    </>
  );
}

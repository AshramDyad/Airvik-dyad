"use client";

import dynamic from "next/dynamic";

import { Skeleton } from "@/components/ui/skeleton";

type DonationFormLoaderProps = {
  currency: string;
};

const DynamicDonationForm = dynamic<DonationFormLoaderProps>(
  () => import("./donation-form").then((module) => module.DonationForm),
  {
    loading: () => <DonationFormSkeleton />,
  },
);

export function DonationFormLoader({ currency }: DonationFormLoaderProps) {
  return <DynamicDonationForm currency={currency} />;
}

function DonationFormSkeleton() {
  return (
    <section id="donation-form" className="bg-muted/30 py-16">
      <div className="mx-auto max-w-5xl rounded-3xl border border-border bg-background p-8 shadow-xl">
        <div className="mb-10 space-y-3 text-center">
          <Skeleton className="mx-auto h-4 w-56" />
          <Skeleton className="mx-auto h-9 w-80" />
          <Skeleton className="mx-auto h-5 w-full max-w-2xl" />
        </div>
        <div className="grid gap-8 md:grid-cols-[2fr,1fr]">
          <div className="space-y-6">
            <div className="grid gap-3 sm:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-12 rounded-2xl" />
              ))}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-20 rounded-xl" />
              ))}
            </div>
            <Skeleton className="h-28 rounded-2xl" />
            <Skeleton className="h-12 rounded-lg" />
          </div>
          <Skeleton className="h-72 rounded-3xl" />
        </div>
      </div>
    </section>
  );
}

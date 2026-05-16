"use client";

import dynamic from "next/dynamic";

import { Skeleton } from "@/components/ui/skeleton";

const DynamicDonationFaqAccordion = dynamic(
  () => import("./faq-accordion").then((module) => module.DonationFaqAccordion),
  {
    loading: () => <DonationFaqAccordionSkeleton />,
  },
);

export function DonationFaqAccordionLoader() {
  return <DynamicDonationFaqAccordion />;
}

function DonationFaqAccordionSkeleton() {
  return (
    <section className="bg-background py-16">
      <div className="mx-auto max-w-3xl px-6">
        <div className="mb-8 space-y-3 text-center">
          <Skeleton className="mx-auto h-4 w-28" />
          <Skeleton className="mx-auto h-9 w-80" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-14 rounded-2xl" />
          ))}
        </div>
      </div>
    </section>
  );
}

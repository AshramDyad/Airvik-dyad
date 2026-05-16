"use client";

import dynamic from "next/dynamic";

import { Skeleton } from "@/components/ui/skeleton";

const DynamicGalleryPageSection = dynamic(
  () =>
    import("@/components/marketing/gallery/gallery-page-section").then(
      (module) => module.GalleryPageSection,
    ),
  {
    loading: () => <GalleryPageSectionSkeleton />,
  },
);

export function GalleryPageSectionLoader() {
  return <DynamicGalleryPageSection />;
}

function GalleryPageSectionSkeleton() {
  return (
    <section className="bg-background py-10 sm:py-12">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-xl space-y-4">
          <Skeleton className="mx-auto h-10 w-72" />
          <Skeleton className="mx-auto h-6 w-full" />
        </div>
        <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3 lg:gap-8 xl:grid-cols-4">
          {Array.from({ length: 12 }).map((_, index) => (
            <Skeleton key={index} className="aspect-[4/3] rounded-2xl" />
          ))}
        </div>
      </div>
    </section>
  );
}

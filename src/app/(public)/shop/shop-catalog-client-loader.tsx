"use client";

import dynamic from "next/dynamic";

import { Skeleton } from "@/components/ui/skeleton";

const DynamicShopCatalogClient = dynamic(
  () =>
    import("./shop-catalog-client").then((module) => module.ShopCatalogClient),
  {
    loading: () => <ShopCatalogSkeleton />,
  },
);

export function ShopCatalogClientLoader() {
  return <DynamicShopCatalogClient />;
}

function ShopCatalogSkeleton() {
  return (
    <div className="container mx-auto space-y-10 px-4 md:px-6">
      <div className="flex items-center justify-between gap-4">
        <Skeleton className="h-10 w-28 rounded-xl" />
        <Skeleton className="h-10 w-44 rounded-xl" />
      </div>
      <div className="grid grid-cols-2 gap-3 md:gap-4 lg:gap-6 sm:grid-cols-2 md:grid-cols-4 xl:grid-cols-5">
        {Array.from({ length: 10 }).map((_, index) => (
          <div key={index} className="space-y-3">
            <Skeleton className="aspect-square w-full rounded-xl" />
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </div>
              <Skeleton className="h-5 w-14" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

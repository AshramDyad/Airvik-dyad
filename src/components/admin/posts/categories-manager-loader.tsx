"use client";

import dynamic from "next/dynamic";

import { Skeleton } from "@/components/ui/skeleton";
import type { Category } from "@/data/types";

type CategoriesManagerLoaderProps = {
  initialCategories: Category[];
};

const DynamicCategoriesManager = dynamic<CategoriesManagerLoaderProps>(
  () =>
    import("@/components/admin/posts/categories-manager").then(
      (module) => module.CategoriesManager,
    ),
  {
    loading: () => <CategoriesManagerSkeleton />,
  },
);

export function CategoriesManagerLoader(props: CategoriesManagerLoaderProps) {
  return <DynamicCategoriesManager {...props} />;
}

function CategoriesManagerSkeleton() {
  return (
    <div className="flex h-[calc(100vh-24rem)] flex-col gap-8 lg:flex-row">
      <Skeleton className="h-[420px] w-full rounded-lg lg:w-[40%]" />
      <div className="flex h-full w-full flex-col gap-4 lg:w-[60%]">
        <Skeleton className="h-10 w-full rounded-md" />
        <Skeleton className="min-h-[360px] flex-1 rounded-lg" />
      </div>
    </div>
  );
}

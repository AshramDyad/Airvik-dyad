"use client";

import dynamic from "next/dynamic";

import { Skeleton } from "@/components/ui/skeleton";
import type { Category, Post } from "@/data/types";

type PostFormLoaderProps = {
  post?: Post;
  categories: Category[];
};

const DynamicPostForm = dynamic<PostFormLoaderProps>(
  () =>
    import("@/components/admin/posts/post-form").then(
      (module) => module.PostForm,
    ),
  { loading: () => <PostFormSkeleton /> },
);

export function PostFormLoader(props: PostFormLoaderProps) {
  return <DynamicPostForm {...props} />;
}

function PostFormSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
      <Skeleton className="h-[640px] w-full rounded-lg lg:col-span-2" />
      <div className="space-y-6">
        <Skeleton className="h-40 w-full rounded-lg" />
        <Skeleton className="h-56 w-full rounded-lg" />
        <Skeleton className="h-72 w-full rounded-lg" />
        <Skeleton className="h-32 w-full rounded-lg" />
      </div>
    </div>
  );
}

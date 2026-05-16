"use client";

import dynamic from "next/dynamic";

import { Skeleton } from "@/components/ui/skeleton";
import type { PostsIndexPanelProps } from "./posts-index-panel";

const DynamicPostsIndexPanel = dynamic<PostsIndexPanelProps>(
  () =>
    import("./posts-index-panel").then((module) => module.PostsIndexPanel),
  {
    loading: () => <PostsIndexSkeleton />,
  },
);

export function PostsIndexLoader(props: PostsIndexPanelProps) {
  return <DynamicPostsIndexPanel {...props} />;
}

function PostsIndexSkeleton() {
  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-card p-4">
        <Skeleton className="mb-4 h-10 w-64 rounded-md" />
        <div className="flex flex-wrap gap-4">
          <Skeleton className="h-10 w-[200px] rounded-md" />
          <Skeleton className="h-10 w-[200px] rounded-md" />
          <Skeleton className="h-10 flex-1 rounded-md" />
        </div>
      </div>
      <Skeleton className="h-[420px] rounded-lg" />
    </div>
  );
}

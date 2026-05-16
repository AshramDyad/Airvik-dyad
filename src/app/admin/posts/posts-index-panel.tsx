"use client";

import type { Category, Post } from "@/data/types";
import { PostsFilters } from "@/components/admin/posts/posts-filters";
import { PostsTable } from "@/components/admin/posts/posts-table";

type PostsIndexPanelProps = {
  categories: Category[];
  posts: Post[];
  postCounts: {
    total: number;
    drafts: number;
  };
  activeStatus: "all" | "draft";
};

export function PostsIndexPanel({
  categories,
  posts,
  postCounts,
  activeStatus,
}: PostsIndexPanelProps) {
  return (
    <>
      <PostsFilters
        categories={categories}
        postCounts={postCounts}
        activeStatus={activeStatus}
      />
      <PostsTable posts={posts} showDraftBadge={activeStatus !== "draft"} />
    </>
  );
}

export type { PostsIndexPanelProps };

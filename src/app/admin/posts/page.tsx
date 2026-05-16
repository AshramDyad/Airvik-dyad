import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getCategories } from "@/lib/api";
import { countPosts, getPosts } from "@/lib/server/posts";
import { requirePageFeature } from "@/lib/server/page-auth";
import { PostsIndexLoader } from "./posts-index-loader";

export default async function PostsPage({
  searchParams,
}: {
  searchParams: Promise<{
    month?: string;
    category?: string;
    search?: string;
    status?: "draft" | "published";
  }>;
}) {
  await requirePageFeature("posts");
  const resolvedSearchParams = await searchParams;
  const baseFilters = {
    month: resolvedSearchParams.month,
    categoryId: resolvedSearchParams.category,
    search: resolvedSearchParams.search,
  };
  const filters = {
    ...baseFilters,
    status: resolvedSearchParams.status,
  } as const;
  const activeStatus = resolvedSearchParams.status === "draft" ? "draft" : "all";

  const [categories, posts, totalPosts, draftPosts] = await Promise.all([
    getCategories(),
    getPosts(filters),
    countPosts(baseFilters),
    countPosts({ ...baseFilters, status: "draft" as const }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Posts</h1>
        <Button asChild>
          <a href="/admin/posts/create">
            <Plus className="mr-2 h-4 w-4" />
            Add Post
          </a>
        </Button>
      </div>

      <PostsIndexLoader
        categories={categories}
        posts={posts}
        postCounts={{ total: totalPosts, drafts: draftPosts }}
        activeStatus={activeStatus}
      />
    </div>
  );
}
